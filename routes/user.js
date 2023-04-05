const express = require('express')
//const { json } = require('body-parser')
const router = express.Router()
const cors = require('cors')
router.use(cors())
router.use(express.json())

const crypto = require('crypto')
//const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const when = require('when')
let iconv = require('iconv-lite');
const { checkLevel, getSQLnParams, getUserPKArrStrWithNewPK,
    isNotNullOrUndefined, namingImagesPath, nullResponse,
    lowLevelResponse, response, removeItems, returnMoment, formatPhoneNumber,
    categoryToNumber, sendAlarm, makeMaxPage, queryPromise, makeHash, commarNumber, getKewordListBySchema,
    getEnLevelByNum, getKoLevelByNum,
    getQuestions, getNumByEnLevel, initialPay, insertItemHistory, getStringHistoryByNum
} = require('../util')
const {
    getRowsNumWithKeyword, getRowsNum, getAllDatas,
    getDatasWithKeywordAtPage, getDatasAtPage,
    getKioskList, getItemRows, getItemList, dbQueryList, dbQueryRows, insertQuery, getTableAI
} = require('../query-util')
const macaddress = require('node-macaddress');

const db = require('../config/db')
const { upload } = require('../config/multerConfig')
const { Console, table } = require('console')
const { abort } = require('process')
const axios = require('axios')
//const { pbkdf2 } = require('crypto')
const salt = "435f5ef2ffb83a632c843926b35ae7855bc2520021a73a043db41670bfaeb722"
const saltRounds = 10
const pwBytes = 64
const jwtSecret = "djfudnsqlalfKeyFmfRkwu"
const { format, formatDistance, formatRelative, subDays } = require('date-fns')
const geolocation = require('geolocation')
const { sqlJoinFormat, listFormatBySchema, myItemSqlJoinFormat, objFormatBySchema } = require('../format/formats')
const { param } = require('jquery')
const kakaoOpt = {
    clientId: '4a8d167fa07331905094e19aafb2dc47',
    redirectUri: 'http://172.30.1.19:8001/api/kakao/callback',
};
const addContract = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 10)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { pay_type, deposit, monthly, document_src, address, address_detail, zip_code, start_date, end_date, pay_day } = req.body;
        let result = await insertQuery('INSERT INTO contract_table (pay_type, deposit, monthly, document_src, address, address_detail, zip_code, start_date, end_date, pay_day, realtor_pk, step) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [pay_type, deposit, monthly, document_src, address, address_detail, zip_code, start_date, end_date, pay_day, decode?.pk, 1]);
        return response(req, res, 100, "success", {
            result_pk: result?.result?.insertId
        });
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }

}
const updateContract = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 10)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { pay_type, deposit, monthly, address, address_detail, zip_code, start_date, pay_day, pk, document_src } = req.body;
        console.log(req.body)

        let value_str = "pay_type=?, deposit=?, monthly=?, address=?, address_detail=?, zip_code=? , start_date=?, pay_day=? ";
        let value_list = [pay_type, deposit, monthly, address, address_detail, zip_code, start_date, pay_day];
        if (document_src) {
            if (document_src == -1) {
                value_list.push('')
            } else {
                value_list.push(document_src)
            }
            value_str += `, document_src=?`
        }
        let result = await insertQuery(`UPDATE contract_table SET ${value_str} WHERE pk=${pk}`, value_list);
        return response(req, res, 100, "success", []);
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }

}
const getHomeContent = async (req, res) => {
    try {

        let result_list = [];
        let sql_list = [
            { table: 'setting', sql: 'SELECT * FROM setting_table', type: 'obj' },
            { table: 'item_category', sql: `SELECT * FROM item_category_table WHERE status=1 ORDER BY sort DESC`, type: 'list' },
            { table: 'item', sql: `SELECT * FROM item_table WHERE status=1 ORDER BY sort DESC LIMIT 4`, type: 'list' },
            { table: 'user', sql: `SELECT * FROM user_table WHERE user_level=0 ORDER BY pk DESC LIMIT 12`, type: 'list' },

        ];

        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i]?.table, sql_list[i]?.sql));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }
        return response(req, res, 100, "success", result_obj)

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const requestContractAppr = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 10);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        const { user_pk, contract_pk, request_level } = req.body;
        let user = await dbQueryList(`SELECT * FROM user_table WHERE pk=${user_pk}`);
        user = user?.result[0];
        let contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${contract_pk}`);
        contract = contract?.result[0];
        if (contract?.realtor_pk != decode?.pk) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        if (request_level == 0 || request_level == 5) {

        } else {
            return response(req, res, -100, "잘못된 레벨입니다.", []);
        }
        if (request_level != user?.user_level) {
            return response(req, res, -100, "선택한 유저의 레벨이 잘못되었습니다.", []);
        }
        let result = await insertQuery(`UPDATE contract_table SET ${getEnLevelByNum(request_level)}_pk=${user_pk} WHERE pk=${contract_pk}`);
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addHeart = async (req, res) => {
    try {
        const { item_pk } = req.body;
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let already_heart = await dbQueryList(`SELECT * FROM heart_table WHERE user_pk=${decode?.pk} AND item_pk=${item_pk} `);
        already_heart = already_heart?.result;
        if (already_heart.length > 0) {
            return response(req, res, -100, "이미 좋아요를 누른 상품입니다.", [])
        }
        await db.beginTransaction();
        let make_history = await insertItemHistory(decode, item_pk, 5, 0);
        let result = await insertQuery(`INSERT INTO heart_table (user_pk, item_pk) VALUES (?, ?)`, [decode?.pk, item_pk]);
        await db.commit();
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const deleteHeart = async (req, res) => {
    try {
        const { item_pk } = req.body;
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        await db.beginTransaction();
        let make_history = await insertItemHistory(decode, item_pk, 6, 0);

        let result = await insertQuery(`DELETE FROM heart_table WHERE user_pk=? AND item_pk=?`, [decode?.pk, item_pk]);
        await db.commit();
        return response(req, res, 100, "success", []);

    } catch (err) {
        console.log(err)
        db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addAuction = async (req, res) => {
    try {
        const { item_pk, price } = req.body;
        console.log(req.body)
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let already_auction = await dbQueryList(`SELECT * FROM auction_table WHERE user_pk=${decode?.pk} AND item_pk=${item_pk} `);
        already_auction = already_auction?.result;
        if (already_auction.length > 0) {
            return response(req, res, -100, "이미 경매한 상품입니다.", [])
        }
        let item = await dbQueryList(`SELECT * FROM item_table WHERE pk=${item_pk}`);
        item = item?.result[0];
        if (price < item?.price) {
            return response(req, res, -100, "최소 입찰 가격 이상으로 신청해 주세요.", [])
        }
        if(item?.end_date < returnMoment().substring(0, 10)){
            return response(req, res, -100, "이미 마감된 경매상품 입니다.", [])
        }
        await db.beginTransaction();
        let make_history = await insertItemHistory(decode, item_pk, 10, price);
        let result = await insertQuery(`INSERT INTO auction_table (user_pk, item_pk, price) VALUES (?, ?, ?)`, [decode?.pk, item_pk, price]);
        await db.commit();
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const deleteAuction = async (req, res) => {
    try {
        const { item_pk } = req.body;
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let auction_history = await dbQueryList(`SELECT * FROM auction_table WHERE user_pk=${decode?.pk} AND item_pk=${item_pk} `);
        auction_history = auction_history?.result[0];

        await db.beginTransaction();
        let make_history = await insertItemHistory(decode, item_pk, 11, (-1) * (auction_history?.price ?? 0));
        let result = await insertQuery(`DELETE FROM auction_table WHERE pk=?`, [auction_history?.pk]);
        await db.commit();
        return response(req, res, 100, "success", []);

    } catch (err) {
        console.log(err)
        db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onBuy = async (req, res) => {
    try {
        const { item_pk } = req.body;
        console.log(req.body)
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        
        let item = await dbQueryList(`SELECT * FROM item_table WHERE pk=${item_pk}`);
        item = item?.result[0];
        if(item?.owner_pk>0){
            return response(req, res, -200, "이미 다른 유저가 구매한 상품 입니다.", [])
        }
        await db.beginTransaction();
        let update_owner = await insertQuery(`UPDATE item_table SET owner_pk=? WHERE pk=?`,[decode?.pk, item_pk]);
        let make_history = await insertItemHistory(decode, item_pk, 25, item?.price);
        await db.commit();
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getProduct = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        const { pk } = req.query;

        let result_list = [];

        let item_columns = [
            'item_table.*',
            '(SELECT COUNT(*) FROM heart_table WHERE item_pk=item_table.pk) AS heart_count',
            'u_t.nickname AS user_nickname',
            'u_t.profile_img AS user_profile_img',
            'o_t.nickname AS owner_nickname',
            'o_t.profile_img AS owner_profile_img',
        ]
        let item_sql = `SELECT ${item_columns.join()} FROM item_table`;
        item_sql += ` LEFT JOIN user_table AS u_t ON item_table.user_pk=u_t.pk `;
        item_sql += ` LEFT JOIN user_table AS o_t ON item_table.user_pk=o_t.pk `;
        item_sql += ` WHERE item_table.pk=${pk} `;


        let items_sql = await sqlJoinFormat('item');
        items_sql = items_sql?.sql;
        items_sql += ` ORDER BY sort DESC LIMIT 4 `

        let history_sql = ` SELECT history_table.*, user_table.nickname AS user_nickname, user_table.profile_img AS user_profile_img `
        history_sql += ` FROM history_table `
        history_sql += ` LEFT JOIN user_table ON history_table.user_pk=user_table.pk `;
        history_sql += ` WHERE item_pk=${pk} ORDER BY pk DESC `;
        let history = await dbQueryList(history_sql);
        history = history?.result;

        let sql_list = [
            { table: 'item', sql: item_sql, type: 'obj' },
            { table: 'items', sql: items_sql, type: 'list' },
            { table: 'history', sql: history_sql, type: 'list' },
        ];

        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i]?.table, sql_list[i]?.sql));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }

        result_obj['item'] = await objFormatBySchema('item', result_obj['item'], decode);
        result_obj['items'] = await listFormatBySchema('item', result_obj['items'], decode);


        let wallet = await dbQueryList(`SELECT * FROM wallet_table WHERE pk=${result_obj['item']?.wallet_pk}`);
        wallet = wallet?.result[0];
        result_obj['item']['wallet'] = wallet;
        let max_price = result_obj['item']['price'];
        if(result_obj['item']?.type==1){
            max_price = await dbQueryList(`SELECT max(price) AS max_price FROM auction_table WHERE item_pk=${pk} `);
            max_price = max_price?.result[0]?.max_price??0;
            if (result_obj['item']['price'] < max_price) {
                result_obj['item']['max_price'] = max_price;
            }
        }
        for (var i = 0; i < result_obj['history'].length; i++) {
            result_obj['history'][i]['note'] = await getStringHistoryByNum(
                {
                    nickname: history[i]?.user_nickname
                },
                result_obj['history'][i]?.type,
                result_obj['history'][i]?.price,
                result_obj['item'],
            )
        }
        await db.beginTransaction();
        if (decode) {
            let make_history = await insertItemHistory(decode, pk, 0, 0);
        }
        let view = insertQuery(`UPDATE item_table SET views=views+1 WHERE pk=?`,[pk]);

        await db.commit();
        return response(req, res, 100, "success", result_obj)
    } catch (err) {
        console.log(err)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getDashBoard = async (req, res) =>{
    try{
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let result_list = [];

        let items_sql = await sqlJoinFormat('item');
        items_sql = items_sql?.sql;
        items_sql += ` ORDER BY sort DESC `;

        let sql_list = [
            { table: 'setting', sql: 'SELECT * FROM setting_table', type: 'obj' },
            { table: 'item_category', sql: `SELECT * FROM item_category_table WHERE status=1 ORDER BY sort DESC`, type: 'list' },
            { table: 'item', sql: `SELECT * FROM item_table WHERE status=1 ORDER BY sort DESC LIMIT 4`, type: 'list' },
            { table: 'items', sql: items_sql, type: 'list' },
            { table: 'wallets', sql: `SELECT * FROM wallet_table ORDER BY sort DESC`, type: 'list' },
            { table: 'hearts', sql: `SELECT * FROM heart_table WHERE user_pk=${decode?.pk} ORDER BY pk DESC`, type: 'list' },
        ];

        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i]?.table, sql_list[i]?.sql));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result_obj = {};
        for (var i = 0; i < sql_list.length; i++) {
            result_list.push(queryPromise(sql_list[i].table, sql_list[i].sql, sql_list[i].type));
        }
        for (var i = 0; i < result_list.length; i++) {
            await result_list[i];
        }
        let result = (await when(result_list));
        for (var i = 0; i < (await result).length; i++) {
            result_obj[(await result[i])?.table] = (await result[i])?.data;
        }
        return response(req, res, 100, "success", result_obj)
    }catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const confirmContractAppr = async (req, res) => {
    try {
        const { contract_pk } = req.body;
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        if (decode?.user_level != 0 && decode?.user_level != 5) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${contract_pk}`);
        contract = contract?.result[0];
        if (contract[`${getEnLevelByNum(decode?.user_level)}_appr`] == 1) {
            return response(req, res, -100, "이미 수락한 계약입니다.", []);
        }
        await db.beginTransaction();
        let result = await insertQuery(`UPDATE contract_table SET ${getEnLevelByNum(decode?.user_level)}_appr=1 WHERE pk=${contract_pk}`);

        let now_contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${contract_pk}`);
        now_contract = now_contract?.result[0];
        await initialPay(now_contract);
        await db.commit();
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onResetContractUser = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 10);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        const { contract_pk, request_level } = req.body;
        let contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${contract_pk}`);
        contract = contract?.result[0];
        if (contract?.realtor_pk != decode?.pk) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        let result = await insertQuery(`UPDATE contract_table SET ${getEnLevelByNum(request_level)}_pk=NULL, ${getEnLevelByNum(request_level)}_appr=0 WHERE pk=${contract_pk}`);
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onChangeCard = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        const { card_number, card_name, card_expire, card_cvc, card_password } = req.body;
        let result = await insertQuery(`UPDATE user_table SET card_number=?, card_name=?, card_expire=?, card_cvc=?, card_password=? WHERE pk=?`, [card_number, card_name, card_expire, card_cvc, card_password, decode?.pk]);
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getCustomInfo = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        const { level, page } = req.query;
        let my_contracts = await dbQueryList(`SELECT * FROM contract_table WHERE ${getEnLevelByNum(decode?.user_level)}_pk=${decode?.pk} ORDER by pk DESC`);
        my_contracts = my_contracts?.result;
        let user_pk_list = my_contracts.map((item) => {
            return item[`${getEnLevelByNum(level)}_pk`]
        })
        let user_count = 0;
        if (user_pk_list.length > 0) {
            user_count = await dbQueryList(`SELECT COUNT(*) FROM user_table WHERE pk IN (${user_pk_list.join()}) `);
            user_count = user_count?.result[0];
            user_count = user_count['COUNT(*)'];
            user_count = makeMaxPage(user_count, 10);
        }
        let user_list = [];
        if (user_pk_list.length > 0) {
            user_list = await dbQueryList(`SELECT * FROM user_table WHERE pk IN (${user_pk_list.join()}) LIMIT ${(page - 1) * 10}, 10`);
            user_list = user_list?.result;
        }
        return response(req, res, 100, "success", {
            data: user_list,
            maxPage: user_count
        });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getMyPays = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        }
        const { page, status, page_cut } = req.query;
        let pay_sql = `SELECT * FROM v_pay `;
        let page_sql = ` SELECT COUNT(*) FROM v_pay `
        let result_obj = {};
        if (status) {
            pay_sql += ` WHERE status=${status} `;
            page_sql += ` WHERE status=${status} `;
        }
        pay_sql += ` ORDER BY pk DESC `
        if (page) {
            pay_sql += ` LIMIT ${(page - 1) * page_cut}, ${page_cut} `;
        }
        let page_result = await dbQueryList(page_sql);
        page_result = page_result?.result[0]['COUNT(*)'];
        page_result = makeMaxPage(page_result, page_cut ?? 10);
        let data_result = await dbQueryList(pay_sql);
        data_result = data_result?.result;
        return response(req, res, 100, "success", {
            data: data_result,
            maxPage: page_result
        });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
module.exports = {
    addContract, getHomeContent, updateContract, requestContractAppr, confirmContractAppr,
    onResetContractUser, onChangeCard, getCustomInfo, getMyPays, addHeart, deleteHeart, getProduct,
    addAuction, deleteAuction, getDashBoard, onBuy
};