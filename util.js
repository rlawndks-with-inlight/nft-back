//const { request } = require('express')
const jwt = require('jsonwebtoken')
const db = require('./config/db')
const firebase = require("firebase-admin");
const fcmNode = require("fcm-node");
const serviceAccount = require("./config/privatekey_firebase.json");
const { insertQuery } = require('./query-util');
const crypto = require('crypto')
const salt = "435f5ef2ffb83a632c843926b35ae7855bc2520021a73a043db41670bfaeb722"
const saltRounds = 10
const pwBytes = 64
const jwtSecret = "djfudnsqlalfKeyFmfRkwu"

const firebaseToken = 'fV0vRpDpTfCnY_VggFEgN7:APA91bHdHP6ilBpe9Wos5Y72SXFka2uAM3luANewGuw7Bx2XGnvUNjK5e5k945xwcXpW8NNei3LEaBtKT2_2A6naix8Wg5heVik8O2Aop_fu8bUibnGxuCe3RLQDtHNrMeC5gmgGRoVh';
const fcmServerKey = "AAAAqJRPduU:APA91bEIVm9-Fli0Bty_hKUggbL0CGKe_CH6Mf1k09j2Iyv9Uqm1C7ILlIhEBNkjt5C5OvNtruMVMioVp962WWjbbxMb5zaY2nQ1TiXYZgFif5tQ58KayHQJpmubjBTeJ32qi3A4leQl";
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount)
});
const sendAlarm = (title, note, table, pk, url) => {
    let fcm = new fcmNode(fcmServerKey)
    let message = {
        to: '/topics/' + 'first_academy',
        "click_action": "FLUTTER_NOTIFICATION_CLICK",
        "priority": "high",
        notification: {
            title: title,
            body: note,
            url: url ?? '/',
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            badge: "1",
            "sound": "default"
        },
        data: {
            table: table,
            pk: pk.toString(),
            url: url ?? '/',
            title: title,
            body: note,
        }
    }
    //const options = { priority: 'high', timeToLive: 60 * 60 * 24 };
    fcm.send(message, (err, res) => {
        if (err) {
            console.log("Error sending message:", err);
        } else {
            console.log("Successfully sent message:", res);
        }
    })
}

let checkLevel = (token, level) => {
    try {
        if (token == undefined)
            return false

        //const decoded = jwt.decode(token)
        const decoded = jwt.verify(token, jwtSecret, (err, decoded) => {
            //console.log(decoded)
            if (err) {
                console.log("token이 변조되었습니다." + err);
                return false
            }
            else return decoded;
        })
        const user_level = decoded.user_level

        if (level > user_level && user_level != -10)
            return false
        else
            return decoded
    }
    catch (err) {
        console.log(err)
        return false
    }
}
const formatPhoneNumber = (input) => {
    const cleanInput = input.replaceAll(/[^0-9]/g, "");
    let result = "";
    const length = cleanInput.length;
    if (length === 8) {
        result = cleanInput.replace(/(\d{4})(\d{4})/, '$1-$2');
    } else if (cleanInput.startsWith("02") && (length === 9 || length === 10)) {
        result = cleanInput.replace(/(\d{2})(\d{3,4})(\d{4})/, '$1-$2-$3');
    } else if (!cleanInput.startsWith("02") && (length === 10 || length === 11)) {
        result = cleanInput.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    } else {
        result = undefined;
    }
    return result;
}
const categoryToNumber = (str) => {
    if (str == 'oneword') {
        return 0;
    } else if (str == 'oneevent') {
        return 1;
    } else if (str == 'theme') {
        return 2;
    } else if (str == 'strategy') {
        return 3;
    } else if (str == 'issue') {
        return 4;
    } else if (str == 'feature') {
        return 5;
    } else if (str == 'video') {
        return 6;
    } else {
        return -1;
    }
}
const queryPromise = (table, sql, type) => {

    return new Promise(async (resolve, reject) => {
        await db.query(sql, (err, result, fields) => {
            if (err) {
                console.log(sql)
                console.log(err)
                reject({
                    code: -200,
                    data: [],
                    table: table
                })
            } else {
                let type_ = type ?? 'list';
                let result_ = undefined;
                if (type_ == 'obj') {
                    result_ = { ...result[0] };
                } else {
                    result_ = [...result];
                }
                resolve({
                    code: 200,
                    data: result_,
                    table: table
                })
            }
        })
    })
}
const lowLevelException = {
    code: 403,
    message: "권한이 없습니다."
}
const nullRequestParamsOrBody = {
    code: 400,
    message: "입력이 잘못되었습니다.(요청 데이터 확인)"
}
const makeMaxPage = (num, page_cut) => {
    if (num % page_cut == 0) {
        return num / page_cut;
    } else {
        return parseInt(num / page_cut) + 1;
    }
}
const logRequestResponse = (req, res, decode) => {

    let requestIp;
    try {
        requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || '0.0.0.0'
    } catch (err) {
        requestIp = '0.0.0.0'
    }

    let request = {
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body,
        file: req.file || req.files || null
    }
    request = JSON.stringify(request)
    let res_ = res;
    let response = JSON.stringify(res_)
    let user_pk = 0;
    let user_id = "";
    if (decode) {
        user_pk = decode.pk;
        user_id = decode.id;
    } else {
        user_pk = -1;
    }
    db.query(
        "INSERT INTO log_table (request, response_result, response_message, request_ip, user_id, user_pk) VALUES (?, ?, ?, ?, ?, ?)",
        [request, res?.result, res?.message, requestIp, user_id, user_pk],
        (err, result, fields) => {
            if (err)
                console.log(err)
            else {
                //console.log(result)
            }
        }
    )

}
const tooMuchRequest = (num) => {
    if (num > 1000) {
        return true;
    }
}
const logRequest = (req) => {
    const requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip
    let request = {
        url: req.originalUrl,
        headers: req.headers,
        query: req.query,
        params: req.params,
        body: req.body
    }
    request = JSON.stringify(request)
    db.query(
        "INSERT INTO log_information_tb (request, request_ip) VALUES (?, ?)",
        [request, requestIp],
        (err, result, fields) => {
            if (err)
                console.log(err)
            else {
                console.log(result)
            }
        }
    )
}
const logResponse = (req, res) => {
    const requestIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip
    let response = JSON.stringify(res)
    // db.query(
    //     "UPDATE log_information_tb SET response=? WHERE request_ip=? ORDER BY pk DESC LIMIT 1",
    //     [response, requestIp],
    //     (err, result, fields) => {
    //         if(err)
    //             console.log(err)
    //         else {
    //             console.log(result)
    //         }
    //     }
    // )
}

/*

*/
const getUserPKArrStrWithNewPK = (userPKArrStr, newPK) => {
    let userPKList = JSON.parse(userPKArrStr)
    if (userPKList.indexOf(newPK) == -1)
        userPKList.push(newPK)
    return JSON.stringify(userPKList)
}

const isNotNullOrUndefined = (paramList) => {
    for (let i in paramList)
        if (i == undefined || i == null)
            return false
    return true
}

// api가 ad인지 product인지 확인 후 파일 네이밍
const namingImagesPath = (api, files) => {
    if (api == "ad") {
        return {
            image: (files) ? "/image/ad/" + files.filename : "/image/ad/defaultAd.png",
            isNull: !(files)
        }
    }
    else if (api == "product") {
        return {
            mainImage: (files.mainImage) ? "/image/item/" + files.mainImage[0].filename : "/image/item/defaultItem.png",
            detailImage: (files.detailImage) ? "/image/detailItem/" + files.detailImage[0].filename : "/image/detailItem/defaultDetail.png",
            qrImage: (files.qrImage) ? "/image/qr/" + files.qrImage[0].filename : "/image/qr/defaultQR.png",
            isNull: [!files.mainImage, !files.detailImage, !files.qrImage]
        }
    }
}
function removeItems(arr, value) {
    var i = 0;
    while (i < arr.length) {
        if (arr[i] === value) {
            arr.splice(i, 1);
        } else {
            ++i;
        }
    }
    return arr;
}

function getSQLnParams(query, params, colNames) {
    let sql = query
    let returnParams = []

    for (let i = 0, count = 0; i < params.length; i++) {
        if (params[i]) {
            if (count > 0)
                sql += ', '
            sql += colNames[i] + '=?'
            returnParams.push(params[i])
            count++
        }
    }
    return { sql, param: returnParams }
}
let concentration_user_list = [];
function response(req, res, code, message, data) {
    var resDict = {
        'result': code,
        'message': message,
        'data': data,
    }
    const decode = checkLevel(req.cookies.token, 0)
    if (code < 0 || req.originalUrl.includes('login') || req.originalUrl.includes('delete') || req.originalUrl.includes('insertpayresult') || concentration_user_list.includes(decode?.pk)) {
        logRequestResponse(req, resDict, decode);
    }
    res.send(resDict);
}
function nullResponse(req, res) {
    response(req, res, -200, "입력이 잘못되었습니다.(요청 데이터 확인)", [])
}
function lowLevelResponse(req, res) {
    response(req, res, -200, "권한이 없습니다", [])
}
const returnMoment = (d) => {
    var today = new Date();
    if (d) {
        today = new Date(d);
    }
    var year = today.getFullYear();
    var month = ('0' + (today.getMonth() + 1)).slice(-2);
    var day = ('0' + today.getDate()).slice(-2);
    var dateString = year + '-' + month + '-' + day;
    var hours = ('0' + today.getHours()).slice(-2);
    var minutes = ('0' + today.getMinutes()).slice(-2);
    var seconds = ('0' + today.getSeconds()).slice(-2);
    var timeString = hours + ':' + minutes + ':' + seconds;
    let moment = dateString + ' ' + timeString;
    return moment;
}
const getQuestions = (length) => {
    let result = [];
    for (var i = 0; i < length; i++) {
        result.push('?');
    }
    return result;
}
const makeHash = (pw_) => {

    return new Promise(async (resolve, reject) => {
        let pw = pw_;
        if (!(typeof pw == 'string')) {
            pw = pw.toString();
        }
        await crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
            // bcrypt.hash(pw, salt, async (err, hash) => {
            let hash = decoded.toString('base64');
            if (err) {
                reject({
                    code: -200,
                    data: undefined,
                })
            } else {
                resolve({
                    code: 200,
                    data: hash,
                })
            }
        })
    })
}
const getKewordListBySchema = (schema_) => {
    let schema = schema_;
    let list = [];
    if (schema == 'user') {
        list = ['id', 'name', 'phone', 'id_number'];
    } else if (schema == 'comment') {
        list = ['user_table.id', 'user_table.nickname', 'note', 'item_title'];
    } else if (schema == 'subscribe') {
        list = ['u_t.id', 'u_t.nickname', 'u_t.name', 'u_t.phone'];
    } else if (schema == 'academy_category') {
        list = ['title', 'user_table.nickname'];
    } else if (schema == 'academy') {
        list = ['academy_table.title', 'academy_category_table.title'];
    } else if (schema == 'app') {
        list = ['name'];
    } else if (schema == 'popup') {
        list = ['link'];
    } else if (schema == 'request') {
        list = ['user_table.id', 'user_table.nickname', 'title'];
    } else if (schema == 'faq') {
        list = ['title'];
    } else if (schema == 'event') {
        list = ['title'];
    } else if (schema == 'notice') {
        list = ['title'];
    } else if (schema == 'review') {
        list = ['review_table.title', 'user_table.nickname'];
    } else if (schema == 'alarm') {
        list = [];
    } else {
        link = [];
    }
    return list;
}
const getEnLevelByNum = (num) => {
    if (num == 0)
        return 'lessee';
    else if (num == 5)
        return 'landlord';
    else if (num == 10)
        return 'realtor';
    else if (num == 40)
        return 'manager';
    else if (num == 50)
        return 'developer';
}
const getNumByEnLevel = (str) => {
    if (str == 'lessee')
        return 0;
    else if (str == 'landlord')
        return 5;
    else if (str == 'realtor')
        return 10;
    else if (str == 'manager')
        return 40;
    else if (str == 'developer')
        return 50;
}
const getKoLevelByNum = (num) => {
    if (num == 0)
        return '임차인';
    else if (num == 5)
        return '임대인';
    else if (num == 10)
        return '공인중개사';
    else if (num == 40)
        return '관리자';
    else if (num == 50)
        return '개발자';
}
const commarNumber = (num) => {
    if (num > 0 && num < 0.000001) {
        return "0.00";
    }
    if (!num && num != 0) {
        return undefined;
    }
    let str = "";
    if (typeof num == "string") {
        str = num;
    } else {
        str = num.toString();
    }

    let decimal = "";
    if (str.includes(".")) {
        decimal = "." + str.split(".")[1].substring(0, 2);
        str = str.split(".")[0];
    } else {
        decimal = "";
    }
    if (str?.length <= 3) {
        return str + decimal;
    }
    let result = "";
    let count = 0;
    for (var i = str?.length - 1; i >= 0; i--) {
        if (count % 3 == 0 && count != 0 && !isNaN(parseInt(str[i]))) result = "," + result;
        result = str[i] + result;
        count++;
    }
    return result + decimal;
}
const initialPay = async (contract) => {
    if (contract['is_confirm'] == 1) {
        return;
    }
    let result = await insertQuery(`UPDATE contract_table SET is_confirm=1 WHERE pk=?`, [contract[`pk`]]);
    if (
        contract[`${getEnLevelByNum(0)}_appr`] == 1 &&
        contract[`${getEnLevelByNum(5)}_appr`] == 1 &&
        contract[`deposit`] > 0 &&
        contract[`monthly`] > 0
    ) {
        let result2 = await insertQuery(`INSERT pay_table (${getEnLevelByNum(0)}_pk, ${getEnLevelByNum(5)}_pk, ${getEnLevelByNum(10)}_pk, price, pay_category, status, contract_pk, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                contract[`${getEnLevelByNum(0)}_pk`],
                contract[`${getEnLevelByNum(5)}_pk`],
                contract[`${getEnLevelByNum(10)}_pk`],
                contract[`deposit`],
                1,
                0,
                contract[`pk`],
                returnMoment().substring(0, 10)
            ])
        let now = returnMoment().substring(0, 10);
        if (now >= `${contract.start_date}`) {//월세 관련
            let pay_list = [];
            let contract_day = `${contract['pay_day'] >= 10 ? `${contract['pay_day']}` : `0${contract['pay_day']}`}`
            let pay_date = contract.start_date.substring(0, 7) + `-${contract_day}`;
            for (var i = 0; i < 100000; i++) {
                //console.log(date_format)'
                if (pay_date.includes('-12-')) {
                    pay_date = pay_date.split('-');
                    pay_date = `${(parseInt(pay_date[0]) + 1)}-01-${contract_day}`
                } else {
                    pay_date = pay_date.split('-');
                    pay_date[1] = parseInt(pay_date[1]) + 1;
                    pay_date[1] = `${pay_date[1] >= 10 ? pay_date[1] : `0${pay_date[1]}`}`
                    pay_date = `${pay_date[0]}-${(pay_date[1])}-${contract_day}`
                }
                if (pay_date <= now && pay_date >= contract.start_date) {
                    pay_list.push(
                        [
                            contract[`${getEnLevelByNum(0)}_pk`],
                            contract[`${getEnLevelByNum(5)}_pk`],
                            contract[`${getEnLevelByNum(10)}_pk`],
                            contract[`monthly`],
                            0,
                            0,
                            contract[`pk`],
                            pay_date
                        ]
                    )
                } else {
                    if (pay_date > now) {
                        break;
                    }
                }
            }
            if (pay_list.length > 0) {
                let result = await insertQuery(`INSERT pay_table (${getEnLevelByNum(0)}_pk, ${getEnLevelByNum(5)}_pk, ${getEnLevelByNum(10)}_pk, price, pay_category, status, contract_pk, day) VALUES ?`, [pay_list]);
            }
        }
    }
}
const insertItemHistory = async (decode, item_pk, type, price) => {
    let obj = {
        user_pk: decode?.pk,
        item_pk,
        type,
        price,
    }
    let keys = Object.keys(obj);
    let values = [];
    let result_keys = [];
    for (var i = 0; i < keys.length; i++) {
        if (obj[keys[i]] || typeof obj[keys[i]] == 'number') {
            values.push(obj[keys[i]]);
            result_keys.push(keys[i]);
        }
    }
    let querstions = getQuestions(result_keys.length)
    let result = await insertQuery(`INSERT INTO history_table (${result_keys.join()}) VALUES (${querstions.join()})`, values);
}
const getStringHistoryByNum = (user, num, price, item, is_detail) => {
    if (num == 0)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품을 조회 하였습니다.`;
    else if (num == 5)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품에 좋아요를 눌렀습니다.`
    else if (num == 6)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품 좋아요를 취소 하였습니다.`
    else if (num == 10)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품을 ${commarNumber(price)} ${is_detail ? item?.wallet_unit : item?.wallet?.unit}에 경매 하였습니다.`
    else if (num == 11)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품 경매를 취소 하였습니다.`
    else if (num == 15)
        return ` ${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품이 수정 되었습니다.`
    else if (num == 20)
        return ` ${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품 경매가 마감 되었습니다.`
    else if (num == 25)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품을 ${commarNumber(price)} ${is_detail ? item?.wallet_unit : item?.wallet?.unit}에 구매 하였습니다.`
    else if (num == 26)
        return `${is_detail ? '' : `${user?.nickname} 이(가) `}${is_detail ? `${item?.name}#${item?.pk}` : ''} 상품을 구매 취소 하였습니다.`
    else
        return '---'
}
module.exports = {
    checkLevel, lowLevelException, nullRequestParamsOrBody,
    logRequestResponse, logResponse, logRequest,
    getUserPKArrStrWithNewPK, isNotNullOrUndefined,
    namingImagesPath, getSQLnParams,
    nullResponse, lowLevelResponse, response, removeItems, returnMoment, formatPhoneNumber, categoryToNumber, sendAlarm, makeMaxPage, tooMuchRequest,
    queryPromise, makeHash, commarNumber, getKewordListBySchema, getEnLevelByNum, getKoLevelByNum, getQuestions, getNumByEnLevel, initialPay, insertItemHistory, getStringHistoryByNum
}