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
    getQuestions, initialPay
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
const { sqlJoinFormat, listFormatBySchema, myItemSqlJoinFormat } = require('../format/formats')
const { param } = require('jquery')
const kakaoOpt = {
    clientId: '4a8d167fa07331905094e19aafb2dc47',
    redirectUri: 'http://172.30.1.19:8001/api/kakao/callback',
};

const addAlarm = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        // 바로할지, 0-1, 요일, 시간, 
        let { title, note, url, type, start_date, days, time } = req.body;


        db.query("INSERT INTO alarm_table (title, note, url, type, start_date, days, time) VALUES (?, ?, ?, ?, ?, ?, ?)", [title, note, url, type, start_date, days, time], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "알람 추가 실패", [])
            }
            else {
                if (type == 0) {
                    sendAlarm(title, note, "alarm", result.insertId, url);
                    insertQuery("INSERT INTO alarm_log_table (title, note, item_table, item_pk, url) VALUES (?, ?, ?, ?, ?)", [title, note, "alarm", result.insertId, url])
                }
                await db.query("UPDATE alarm_table SET sort=? WHERE pk=?", [result.insertId, result.insertId], (err, result) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "알람 추가 실패", [])
                    }
                    else {
                        return response(req, res, 200, "알람 추가 성공", [])
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getNoticeAndAlarmLastPk = (req, res) => {
    try {
        db.query("SELECT * FROM alarm_log_table ORDER BY pk DESC LIMIT 1", async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버에러발생", [])
            }
            else {
                await db.query("SELECT * FROM notice_table ORDER BY pk DESC LIMIT 1", (err, result2) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버에러발생", [])

                    }
                    else {
                        return response(req, res, 100, "success", { alarm_last_pk: result[0]?.pk ?? 0, notice_last_pk: result2[0]?.pk ?? 0 })
                    }
                })
            }
        })
    } catch (e) {

    }
}
const updateAlarm = (req, res) => {
    try {
        // 바로할지, 0-1, 요일, 시간, 
        let { title, note, url, type, start_date, days, time, pk } = req.body;
        db.query("UPDATE alarm_table SET title=?, note=?, url=?, type=?, start_date=?, days=?, time=? WHERE pk=?", [title, note, url, type, start_date, days, time, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "알람 수정 실패", [])
            }
            else {
                return response(req, res, 200, "알람 수정 성공", [])
            }
        })

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onSignUp = async (req, res) => {
    try {
        //logRequest(req)
        const {
            id,
            name,
            id_number,
            nickname,
            phone,
            address,
            address_detail,
            zip_code,
            type,
            profile_img,
            parent_id,
            company_number,
            office_name,
            office_number,
            office_classification,
            broker_classification,
            status_classification,
        } = req.body;
        let user_level = req.body.user_level ?? 0;
        let pw = req.body.pw ?? "";
        let sql = "SELECT * FROM user_table WHERE id=? ";
        let find_user = await dbQueryList(`SELECT * FROM user_table WHERE id=?`, [id]);
        find_user = find_user?.result;
        if (find_user.length > 0) {
            return response(req, res, -100, "아이디가 중복됩니다.", []);
        }
        let find_phone = await dbQueryList(`SELECT * FROM user_table WHERE phone=?`, [phone]);
        find_phone = find_phone?.result;
        if (find_phone.length > 0) {
            return response(req, res, -100, "휴대폰번호가 중복됩니다.", []);
        }

        pw = await makeHash(pw);
        pw = pw?.data;
        let insert_obj = {
            id,
            pw,
            name,
            nickname,
            phone,
            address,
            address_detail,
            zip_code,
            user_level,
            profile_img,
        }
        if (
            !user_level ||
            user_level == 0 ||
            user_level == 10 ||
            user_level == 15 ||
            user_level == 20
        ) {
            let parent_user = await dbQueryList(`SELECT * FROM user_table WHERE id=?`, [parent_id]);
            parent_user = parent_user?.result[0];
            if (!parent_user) {
                return response(req, res, -100, "존재하지 않는 추천아이디 입니다.", []);
            }
            if (user_level >= parent_user?.user_level) {
                return response(req, res, -100, "추천인 레벨이 가입유저보다 낮습니다.", []);
            }
            insert_obj['parent_pk'] = parent_user?.pk;
            insert_obj['parent_id'] = parent_user?.id;
        }
        let type_number = ['user_level'];
        let insertKeys = Object.keys(insert_obj);
        let insertValues = [];
        for (var i = 0; i < insertKeys.length; i++) {
            if (type_number.includes(insertKeys[i])) {
                insertValues.push(insert_obj[insertKeys[i]] ?? 0);
            } else {
                insertValues.push(insert_obj[insertKeys[i]] ?? "");
            }
        }
        await db.beginTransaction();
        let result = await insertQuery(`INSERT INTO user_table (${insertKeys.join()}) VALUES (${getQuestions(insertKeys.length).join()})`, insertValues);
        let result2 = await insertQuery("UPDATE user_table SET sort=? WHERE pk=?", [result?.result?.insertId, result?.result?.insertId]);
        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        console.log(err);
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateUser = async (req, res) => {
    try {
        const id = req.body.id ?? "";
        let pw = req.body.pw ?? "";
        const name = req.body.name ?? "";
        const nickname = req.body.nickname ?? "";
        const phone = req.body.phone ?? "";
        const profile_img = req.body.profile_img ?? "";
        const address = req.body.address ?? "";
        const user_level = req.body.user_level ?? 0;
        const address_detail = req.body.address_detail ?? "";
        const zip_code = req.body.zip_code ?? "";
        const company_number = req.body.company_number ?? "";
        const office_name = req.body.office_name ?? "";
        const office_number = req.body.office_number ?? "";
        const office_classification = req.body.office_classification ?? "";
        const broker_classification = req.body.broker_classification ?? "";
        const status_classification = req.body.status_classification ?? "";
        const parent_id = req.body.parent_id ?? "";
        const pk = req.body.pk ?? 0;
        let body = {
            id,
            pw,
            name,
            nickname,
            phone,
            address,
            address_detail,
            zip_code,
            user_level,
            profile_img,
        }
        if (pw) {
            pw = await makeHash(pw);
            pw = pw?.data;
            body['pw'] = pw;
        }
        if (
            user_level == 0 ||
            user_level == 10 ||
            user_level == 15 ||
            user_level == 20
        ) {
            let parent_user = await dbQueryList(`SELECT * FROM user_table WHERE id=?`, [parent_id]);
            parent_user = parent_user?.result[0];
            if (!parent_user) {
                return response(req, res, -100, "존재하지 않는 추천아이디 입니다.", []);
            }
            if (user_level >= parent_user?.user_level) {
                return response(req, res, -100, "추천인 레벨이 가입유저보다 낮습니다.", []);
            }
            body['parent_pk'] = parent_user?.pk;
            body['parent_id'] = parent_user?.id;
        }
        let keys = Object.keys(body);
        let values = [];
        for (var i = 0; i < keys.length; i++) {
            values.push(body[keys[i]])
        }
        values.push(pk);
        let result = await insertQuery(`UPDATE user_table SET ${keys.join('=?, ')}=? WHERE pk=?`, values);
        return response(req, res, 100, "성공적으로 저장 되었습니다.", [])

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getUserDepth = (user_obj, user_) => {
    let depth = 0;
    let user = user_;
    for (var i = 0; i < 1000; i++) {
        if (user?.user_level == 25) {
            break;
        } else {
            depth++;
            user = user_obj[user?.parent_pk];
        }
    }
    return depth;
}
const getGenealogy = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let users = await dbQueryList(`SELECT * FROM user_table WHERE user_level < 40 ORDER BY user_level DESC`);
        users = users?.result;
        let user_obj = {};
        for (var i = 0; i < users.length; i++) {
            user_obj[users[i]?.pk] = users[i];
        }
        for (var i = 0; i < users.length; i++) {
            users[i]['depth'] = await getUserDepth(user_obj, users[i]);
        }
        let depth_list = [];
        for (var i = 0; i < 1000; i++) {
            depth_list[i] = {};
        }
        for (var i = 0; i < users.length; i++) {
            if (!depth_list[users[i]?.depth][`${users[i]?.parent_pk}`]) {
                depth_list[users[i]?.depth][`${users[i]?.parent_pk}`] = [];
            }
            depth_list[users[i]?.depth][`${users[i]?.parent_pk}`].push(users[i]);
            depth_list[users[i]?.depth + 1][`${users[i]?.pk}`] = [];
        }
        return response(req, res, 100, "success", { data: depth_list, mine: {} });

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLoginById = async (req, res) => {
    try {
        let { id, pw } = req.body;
        db.query('SELECT * FROM user_table WHERE id=?', [id], async (err, result1) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result1.length > 0) {
                    await crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                        // bcrypt.hash(pw, salt, async (err, hash) => {
                        let hash = decoded.toString('base64');
                        console.log(hash)
                        console.log(result1[0].pw)
                        if (hash == result1[0].pw) {
                            try {
                                const token = jwt.sign({
                                    pk: result1[0].pk ?? 0,
                                    nickname: result1[0].nickname ?? "",
                                    name: result1[0].name ?? "",
                                    id: result1[0].id ?? "",
                                    user_level: result1[0].user_level ?? -1,
                                    phone: result1[0].phone ?? "",
                                    profile_img: result1[0].profile_img ?? "",
                                    type: result1[0].type ?? -1
                                },
                                    jwtSecret,
                                    {
                                        expiresIn: '60000m',
                                        issuer: 'fori',
                                    });
                                res.cookie("token", token, {
                                    httpOnly: true,
                                    maxAge: 60 * 60 * 1000 * 10 * 10 * 10,
                                    //sameSite: 'none', 
                                    //secure: true 
                                });
                                db.query('UPDATE user_table SET last_login=? WHERE pk=?', [returnMoment(), result1[0].pk], (err, result) => {
                                    if (err) {
                                        console.log(err)
                                        return response(req, res, -200, "서버 에러 발생", [])
                                    }
                                })
                                return response(req, res, 200, '환영합니다.', result1[0]);
                            } catch (e) {
                                console.log(e)
                                return response(req, res, -200, "서버 에러 발생", [])
                            }
                        } else {
                            return response(req, res, -100, "아이디 또는 비밀번호를 확인해주세요.", [])

                        }
                    })
                } else {
                    return response(req, res, -100, "아이디 또는 비밀번호를 확인해주세요.", [])
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLoginBySns = (req, res) => {
    try {
        let { id, typeNum, name, nickname, phone, user_level, profile_img } = req.body;
        db.query("SELECT * FROM user_table WHERE id=? AND type=?", [id, typeNum], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {//기존유저
                    let token = jwt.sign({
                        pk: result[0].pk,
                        nickname: result[0].nickname,
                        id: result[0].id,
                        user_level: result[0].user_level,
                        phone: result[0].phone,
                        profile_img: result[0].profile_img,
                        type: typeNum
                    },
                        jwtSecret,
                        {
                            expiresIn: '6000m',
                            issuer: 'fori',
                        });
                    res.cookie("token", token, { httpOnly: true, maxAge: 60 * 60 * 1000 * 10 * 10 * 10 });
                    await db.query('UPDATE user_table SET last_login=? WHERE pk=?', [returnMoment(), result[0].pk], (err, result) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -200, "서버 에러 발생", [])
                        }
                    })
                    return response(req, res, 200, result[0].nickname + ' 님 환영합니다.', result[0]);
                } else {//신규유저
                    return response(req, res, 50, '신규회원 입니다.', []);
                }
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}


const uploadProfile = (req, res) => {
    try {
        if (!req.file) {
            return response(req, res, 100, "success", [])
        }
        const image = '/image/' + req.file.fieldname + '/' + req.file.filename;
        const id = req.body.id;
        db.query('UPDATE user_table SET profile_img=? WHERE id=?', [image, id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getMyInfo = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let result = await dbQueryList(`SELECT * FROM user_table WHERE pk=${decode?.pk}`);
        result = result?.result[0];
        return response(req, res, 100, "success", result);
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const editMyInfo = async (req, res) => {
    try {
        let { pw, nickname, newPw, phone, id, zip_code, address, address_detail, account_holder, bank_name, account_number, typeNum } = req.body;
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        if (decode?.id != id) {
            return response(req, res, -150, "잘못된 접근입니다.", [])
        }
        let user = await dbQueryList('SELECT * FROM user_table WHERE pk=?', [decode?.pk]);
        user = user?.result[0];
        pw = await makeHash(pw);
        pw = pw?.data;
        if (user?.pw != pw) {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", [])
        }
        if (typeNum == 0) {
            let result = insertQuery("UPDATE user_table SET zip_code=?, address=?, address_detail=?, account_holder=?, bank_name=?, account_number=? WHERE pk=?", [zip_code, address, address_detail, account_holder, bank_name, account_number, decode?.pk]);
            return response(req, res, 100, "success", []);
        } else {

            if (newPw) {
                await crypto.pbkdf2(newPw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
                    // bcrypt.hash(pw, salt, async (err, hash) => {
                    let new_hash = decoded.toString('base64')
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "새 비밀번호 암호화 도중 에러 발생", [])
                    }
                    await db.query("UPDATE user_table SET pw=? WHERE id=?", [new_hash, id], (err, result) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -100, "서버 에러 발생", []);
                        } else {
                            return response(req, res, 100, "success", []);
                        }
                    })
                })
            } else if (nickname || phone) {
                let selectSql = "";
                let updateSql = "";
                let zColumn = [];
                if (nickname) {
                    selectSql = "SELECT * FROM user_table WHERE nickname=? AND id!=?"
                    updateSql = "UPDATE user_table SET nickname=? WHERE id=?";
                    zColumn.push(nickname);
                } else if (phone) {
                    selectSql = "SELECT * FROM user_table WHERE phone=? AND id!=?"
                    updateSql = "UPDATE user_table SET phone=? WHERE id=?";
                    zColumn.push(phone);
                }
                zColumn.push(id);
                await db.query(selectSql, zColumn, async (err, result1) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -100, "서버 에러 발생", []);
                    } else {
                        if (result1.length > 0) {
                            let message = "";
                            if (nickname) {
                                message = "이미 사용중인 닉네임 입니다.";
                            } else if (phone) {
                                message = "이미 사용중인 전화번호 입니다.";
                            }
                            return response(req, res, -50, message, []);
                        } else {
                            await db.query(updateSql, zColumn, (err, result2) => {
                                if (err) {
                                    console.log(err)
                                    return response(req, res, -100, "서버 에러 발생", []);
                                } else {
                                    return response(req, res, 100, "success", []);
                                }
                            })
                        }
                    }
                })
            }
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onResign = async (req, res) => {
    try {
        let { pw } = req.body;
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        pw = await makeHash(pw);
        pw = pw?.data;
        let user = await dbQueryList(`SELECT * FROM user_table WHERE pk=?`, [decode?.pk]);
        user = user?.result[0];
        if (user?.pw != pw) {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", []);
        }
        await db.beginTransaction();
        let result = await insertQuery("DELETE FROM user_table WHERE pk=?", [decode?.pk]);
        await res.clearCookie('token');

        await db.commit();
        return response(req, res, 100, "success", []);

    } catch (e) {
        console.log(e)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const kakaoCallBack = (req, res) => {
    try {
        const token = req.body.token;
        async function kakaoLogin() {
            let tmp;

            try {
                const url = 'https://kapi.kakao.com/v2/user/me';
                const Header = {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                };
                tmp = await axios.get(url, Header);
            } catch (e) {
                console.log(e);
                return response(req, res, -200, "서버 에러 발생", [])
            }

            try {
                const { data } = tmp;
                const { id, properties } = data;
                return response(req, res, 100, "success", { id, properties });

            } catch (e) {
                console.log(e);
                return response(req, res, -100, "서버 에러 발생", [])
            }

        }
        kakaoLogin();

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}



const sendAligoSms = ({ receivers, message }) => {
    return axios.post('https://apis.aligo.in/send/', null, {
        params: {
            key: 'neop9fa86bgrbim08pq4r9butgkza4c4',
            user_id: 'onupayment',
            sender: '010-4749-1981',
            receiver: receivers.join(','),
            msg: message
        },
    }).then((res) => res.data).catch(err => {
        console.log('err', err);
    });
}
const sendSms = (req, res) => {
    try {
        let receiver = req.body.receiver;
        const content = req.body.content;
        console.log(req.body)
        sendAligoSms({ receivers: receiver, message: content }).then((result) => {
            console.log(result)
            if (result.result_code == '1') {
                return response(req, res, 100, "success", [])
            } else {
                return response(req, res, -100, "fail", [])
            }
        });
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const findIdByPhone = (req, res) => {
    try {
        const phone = req.body.phone;
        db.query("SELECT pk, id FROM user_table WHERE phone=?", [phone], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const findAuthByIdAndPhone = (req, res) => {
    try {
        const id = req.body.id;
        const phone = req.body.phone;
        db.query("SELECT * FROM user_table WHERE id=? AND phone=?", [id, phone], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, 100, "success", result[0]);
                } else {
                    return response(req, res, -50, "아이디 또는 비밀번호를 확인해주세요.", []);
                }
            }
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistId = (req, res) => {
    try {
        const id = req.body.id;
        db.query(`SELECT * FROM user_table WHERE id=? `, [id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, -50, "이미 사용중인 아이디입니다.", []);
                } else {
                    return response(req, res, 100, "사용가능한 아이디입니다.", []);
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkPassword = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let pw = req.body.pw;
        let user = await dbQueryList(`SELECT * FROM user_table WHERE pk=?`, [decode?.pk]);
        user = user?.result[0];

        pw = await makeHash(pw);
        pw = pw?.data;
        if (pw == user?.pw) {
            return response(req, res, 100, "success", [])
        } else {
            return response(req, res, -100, "비밀번호가 일치하지 않습니다.", [])
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistIdByManager = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const id = req.body.id;
        db.query(`SELECT * FROM user_table WHERE id=? `, [id], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const checkExistNickname = (req, res) => {
    try {
        const nickname = req.body.nickname;
        db.query(`SELECT * FROM user_table WHERE nickname=? `, [nickname], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                if (result.length > 0) {
                    return response(req, res, -50, "이미 사용중인 닉네임입니다.", []);
                } else {
                    return response(req, res, 100, "사용가능한 닉네임입니다.", []);
                }
            }
        })

    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const changePassword = (req, res) => {
    try {
        const id = req.body.id;
        let pw = req.body.pw;
        crypto.pbkdf2(pw, salt, saltRounds, pwBytes, 'sha512', async (err, decoded) => {
            // bcrypt.hash(pw, salt, async (err, hash) => {
            let hash = decoded.toString('base64')

            if (err) {
                console.log(err)
                return response(req, res, -200, "비밀번호 암호화 도중 에러 발생", [])
            }

            await db.query("UPDATE user_table SET pw=? WHERE id=?", [hash, id], (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    return response(req, res, 100, "success", [])
                }
            })
        })
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getUserToken = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (decode) {
            let pk = decode.pk;
            let nickname = decode.nickname;
            let name = decode.name;
            let id = decode.id;
            let phone = decode.phone;
            let user_level = decode.user_level;
            let profile_img = decode.profile_img;
            let type = decode.type;
            res.send({ id, pk, name, phone, user_level, profile_img, type })
        }
        else {
            res.send({
                pk: -1,
                level: -1
            })
        }
    } catch (e) {
        console.log(e)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onLogout = (req, res) => {
    try {
        res.clearCookie('token')
        //res.clearCookie('rtoken')
        return response(req, res, 200, "로그아웃 성공", [])
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getUsers = (req, res) => {
    try {
        let sql = "SELECT * FROM user_table ";
        let pageSql = "SELECT COUNT(*) FROM user_table ";
        let page_cut = req.query.page_cut;
        let status = req.query.status;
        let keyword = req.query.keyword;
        let userType = req.query.userType;
        let userLevel = req.query.userLevel;
        let whereStr = " WHERE 1=1 ";
        if (req.query.level) {
            if (req.query.level == 0) {
                whereStr += ` AND user_level <= ${req.query.level} `;
            } else {
                whereStr += ` AND user_level=${req.query.level} `;
            }
        }
        if (userType) {
            whereStr += ` AND type=${userType} `;
        }
        if (userLevel) {
            whereStr += ` AND user_level=${userLevel} `;
        }
        if (status) {
            whereStr += ` AND status=${status} `;
        }
        if (keyword) {
            whereStr += ` AND (id LIKE '%${keyword}%' OR name LIKE '%${keyword}%' OR nickname LIKE '%${keyword}%' OR phone LIKE '%${keyword}%')`;
        }
        if (!page_cut) {
            page_cut = 15
        }
        pageSql = pageSql + whereStr;
        sql = sql + whereStr + " ORDER BY sort DESC ";
        if (req.query.page) {
            sql += ` LIMIT ${(req.query.page - 1) * page_cut}, ${page_cut}`;
            db.query(pageSql, async (err, result1) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    await db.query(sql, (err, result2) => {
                        if (err) {
                            console.log(err)
                            return response(req, res, -200, "서버 에러 발생", [])
                        } else {
                            let maxPage = result1[0]['COUNT(*)'] % page_cut == 0 ? (result1[0]['COUNT(*)'] / page_cut) : ((result1[0]['COUNT(*)'] - result1[0]['COUNT(*)'] % page_cut) / page_cut + 1);
                            return response(req, res, 100, "success", { data: result2, maxPage: maxPage });
                        }
                    })
                }
            })
        } else {
            db.query(sql, (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    return response(req, res, 100, "success", result)
                }
            })
        }
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}



const getHeaderContent = async (req, res) => {
    try {
        let result_list = [];
        let sql_list = [
            { table: 'top_banner', sql: 'SELECT * FROM setting_table ORDER BY pk DESC LIMIT 1', type: 'obj' },
            { table: 'popup', sql: 'SELECT * FROM popup_table WHERE status=1 ORDER BY sort DESC', type: 'list' },
            { table: 'master', sql: 'SELECT pk, nickname, name FROM user_table WHERE user_level=30 AND status=1  ORDER BY sort DESC', type: 'list' },
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

const getVideo = (req, res) => {
    try {
        const pk = req.params.pk;
        let sql = `SELECT video_table.* , user_table.nickname, user_table.name FROM video_table LEFT JOIN user_table ON video_table.user_pk = user_table.pk WHERE video_table.pk=${pk} LIMIT 1`;
        db.query(sql, async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                let relate_video = JSON.parse(result[0].relate_video);
                relate_video = relate_video.join();
                await db.query(`SELECT title, date, pk FROM video_table WHERE pk IN (${relate_video})`, (err, result2) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버 에러 발생", [])
                    } else {
                        return response(req, res, 100, "success", { video: result[0], relate: result2 })
                    }
                })
            }
        })
        db.query(sql)
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getComments = (req, res) => {
    try {

        const { pk, category } = req.query;
        let zColumn = [];
        let columns = ""
        if (pk) {
            zColumn.push(pk)
            columns += " AND comment_table.item_pk=? ";
        }
        if (category) {
            zColumn.push(category)
            columns += " AND comment_table.category_pk=? ";
        }
        db.query(`SELECT comment_table.*, user_table.nickname, user_table.profile_img FROM comment_table LEFT JOIN user_table ON comment_table.user_pk = user_table.pk WHERE 1=1 ${columns} ORDER BY pk DESC`, zColumn, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", result)
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addComment = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        let auth = {};
        if (!decode || decode?.user_level == -10) {
            return response(req, res, -150, "권한이 없습니다.", [])
        } else {
            auth = decode;

        }
        let { pk, parentPk, title, note, category } = req.body;
        let userPk = auth.pk;
        let userNick = auth.nickname;
        db.query("INSERT INTO comment_table (user_pk, user_nickname, item_pk, item_title, note, category_pk, parent_pk) VALUES (?, ?, ?, ?, ?, ?, ?)", [userPk, userNick, pk, title, note, category, parentPk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateComment = (req, res) => {
    try {
        const { pk, note } = req.body;

        db.query("UPDATE comment_table SET note=? WHERE pk=?", [note, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "fail", [])
            }
            else {
                return response(req, res, 200, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getCommentsManager = (req, res) => {
    try {
        let sql = `SELECT COUNT(*) FROM comment_table `
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getKoreaByEng = (str) => {
    let ans = "";
    if (str == 'oneword') {
        ans = "하루1단어: ";
    } else if (str == 'oneevent') {
        ans = "하루1종목: ";
    } else if (str == 'theme') {
        ans = "핵심테마: ";
    } else if (str == 'strategy') {
        ans = "전문가칼럼: ";
    } else if (str == 'issue') {
        ans = "핵심이슈: ";
    } else if (str == 'feature') {
        ans = "특징주: ";
    }
    return ans;
}
const addItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let body = { ...req.body };
        delete body['table'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        let values = [];
        let values_str = "";

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw') {
                body[keys[i]] = await makeHash(body[keys[i]])?.data;
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        let use_user_pk_list = ['notice', 'faq', 'item'];
        if (use_user_pk_list.includes(table)) {
            keys.push('user_pk');
            values.push(decode?.pk);
            values_str += ", ?"
        }
        let sql = `INSERT INTO ${table}_table (${keys.join()}) VALUES (${values_str}) `;
        await db.beginTransaction();
        let result = await insertQuery(sql, values);
        let not_use_sort = ['subscribe'];
        if (!not_use_sort.includes(table)) {
            let result2 = await insertQuery(`UPDATE ${table}_table SET sort=? WHERE pk=?`, [result?.result?.insertId, result?.result?.insertId]);
        }
        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        await db.rollback();
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addItemByUserSettingBySchema = async (schema, keys_, values_str_, values_, body_) => {
    let body = body_;
    let keys = keys_;
    let values_str = values_str_;
    let values = values_;
    if (schema == 'review') {
        let class_item = await dbQueryList(`SELECT * FROM academy_category_table WHERE pk=?`, [body?.academy_category_pk]);
        class_item = class_item?.result[0];
        keys.push('master_pk');
        values_str += ", ?"
        values.push(class_item?.master_pk);
    }
    return {
        keys: keys,
        values_str: values_str,
        values: values,
    }
}
const addItemByUser = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let permission_schema = ['request', 'review', 'item'];
        if (!permission_schema.includes(req.body.table)) {
            return response(req, res, -150, "잘못된 접근입니다.", [])
        }
        let body = { ...req.body };
        delete body['table'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        let values = [];
        let values_str = "";

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw') {
                body[keys[i]] = await makeHash(body[keys[i]])?.data;
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        let use_user_pk = ['request', 'review', 'item'];
        let use_sort_tables = ['item']
        if (use_user_pk.includes(table)) {
            keys.push('user_pk');
            values.push(decode?.pk);
            values_str += ", ?"
        }
        let setting = await addItemByUserSettingBySchema(table, keys, values_str, values, body);

        keys = setting?.keys;
        values_str = setting?.values_str;
        values = setting?.values;
        let sql = `INSERT INTO ${table}_table (${keys.join()}) VALUES (${values_str}) `;
        await db.beginTransaction();
        let result = await insertQuery(sql, values);

        console.log(result)
        if(use_sort_tables.includes(table)){
            let result2 = await insertQuery(`UPDATE ${table}_table SET sort=? WHERE pk=?`, [result?.result?.insertId, result?.result?.insertId]);
        }
        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        await db.rollback();
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const updateItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let body = { ...req.body };
        let use_manager_pk = ['request'];
        delete body['table'];
        delete body['pk'];
        delete body['hash_list'];
        delete body['reason_correction'];
        delete body['manager_note'];
        let keys = Object.keys(body);
        if (keys.length == 0) {
            return response(req, res, 200, "success", []);
        }
        let values = [];
        let values_str = "";
        if (req.body.hash_list && req.body.hash_list?.length > 0) {
            for (var i = 0; i < req.body.hash_list?.length; i++) {
                let hash_result = await makeHash(body[req.body.hash_list[i]]);
                if (!hash_result) {
                    return response(req, res, -100, "fail", [])
                } else {
                    body[req.body.hash_list[i]] = hash_result?.data;
                }
            }
        }

        for (var i = 0; i < keys.length; i++) {
            if (keys[i] == 'pw' && body[keys[i]]) {
                body[keys[i]] = await makeHash(body[keys[i]]);
            }
            values.push(body[keys[i]]);
            if (i != 0) {
                values_str += ",";
            }
            values_str += " ?";
        }

        let files = { ...req.files };
        let files_keys = Object.keys(files);
        for (var i = 0; i < files_keys.length; i++) {
            values.push(
                '/image/' + req.files[files_keys][0].fieldname + '/' + req.files[files_keys][0].filename
            );
            keys.push('img_src');
            values_str += ", ?"
        }
        let table = req.body.table;
        if (use_manager_pk.includes(table)) {
            values.push(decode?.pk);
            if (i != 0) {
                values_str += ",";
            }
            keys.push('manager_pk');
            values_str += " ?";
        }
        let sql = `UPDATE ${table}_table SET ${keys.join("=?,")}=? WHERE pk=?`;
        values.push(req.body.pk);
        await db.beginTransaction();
        let result = await insertQuery(sql, values);
        let result2 = await updatePlusUtil(table, req.body);
        await db.commit();
        return response(req, res, 200, "success", []);

    } catch (err) {
        console.log(err)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updatePlusUtil = async (schema, body) => {
    if (schema == 'academy_category') {
        let result = await insertQuery(`UPDATE subscribe_table SET end_date=? WHERE academy_category_pk=?`, [body?.end_date, body?.pk]);
    }
}

const addPopup = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { link } = req.body;
        let image = "";
        if (req.file) {
            image = '/image/' + req.file.fieldname + '/' + req.file.filename;
        }
        db.query("INSERT INTO popup_table (link,img_src) VALUES (?,?)", [link, image], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", []);
            } else {
                await db.query("UPDATE popup_table SET sort=? WHERE pk=?", [result?.insertId, result?.insertId], (err, resultup) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "fail", [])
                    }
                    else {
                        return response(req, res, 200, "success", [])
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updatePopup = (req, res) => {
    try {
        const { link, pk } = req.body;
        let zColumn = [link];
        let columns = " link=?";
        let image = "";
        if (req.file) {
            image = '/image/' + req.file.fieldname + '/' + req.file.filename;
            zColumn.push(image);
            columns += ', main_img=? '
        }
        zColumn.push(pk)
        db.query(`UPDATE popup_table SET ${columns} WHERE pk=?`, zColumn, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", []);
            } else {
                return response(req, res, 100, "success", []);
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const addNoteImage = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        if (req.file) {
            return response(req, res, 100, "success", { filename: `/image/note/${req.file.filename}` })
        } else {
            return response(req, res, -100, "이미지가 비어 있습니다.", [])
        }
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}
const addImageItems = (req, res) => {
    try {
        let files = { ...req.files };
        let files_keys = Object.keys(files);
        let result = [];
        for (var i = 0; i < files_keys.length; i++) {
            result.push({
                key: files_keys[i],
                filename: '/image/' + req.files[files_keys[i]][0].fieldname + '/' + req.files[files_keys[i]][0].filename
            })
        }
        return response(req, res, 100, "success", result);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}


const onSearchAllItem = async (req, res) => {
    try {
        let keyword = req.query.keyword;

        let sql_list = [];
        let sql_obj = [{ table: 'oneword', column: ['pk', 'title', 'hash'], wheres: ['title', 'hash', 'note'] },
        { table: 'oneevent', column: ['pk', 'title', 'hash'], wheres: ['title', 'hash', 'note'] },
        { table: 'issue', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'feature', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'theme', column: ['pk', 'title', 'hash', 'main_img', 'font_color', 'background_color', 'date'], wheres: ['title', 'hash', 'note'] },
        { table: 'video', column: ['pk', 'title', 'font_color', 'background_color', 'link'], wheres: ['title', 'note'] },
        ]
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";
            sql = `SELECT ${sql_obj[i].column.join()} FROM ${sql_obj[i].table}_table WHERE status=1 AND (`;
            for (var j = 0; j < sql_obj[i].wheres.length; j++) {
                if (j != 0) {
                    sql += ` OR `
                }
                sql += ` ${sql_obj[i].wheres[j]} LIKE "%${keyword}%" `
            }
            sql += `) ORDER BY sort DESC LIMIT 8 `;

            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result = (await when(sql_list));
        return response(req, res, 100, "success", { oneWord: (await result[0])?.data ?? [], oneEvent: (await result[1])?.data ?? [], issues: (await result[2])?.data ?? [], features: (await result[3])?.data ?? [], themes: (await result[4])?.data ?? [], videos: (await result[5])?.data ?? [] });


    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getAllPosts = async (req, res) => {
    try {
        let { keyword, page, order, page_cut } = req.query;
        if (!page_cut) {
            page_cut = 15;
        }
        let sql_list = [];
        let sql_obj = [
            { table: 'oneword', category_num: 0 },
            { table: 'oneevent', category_num: 1 },
            { table: 'theme', category_num: 2 },
            { table: 'strategy', category_num: 3 },
            { table: 'issue', category_num: 4 },
            { table: 'feature', category_num: 5 },
            { table: 'video', category_num: 6 },
            { table: 'notice', category_num: 7 },
        ]
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";
            sql = `SELECT ${sql_obj[i].table}_table.title, ${sql_obj[i].table}_table.date, ${sql_obj[i].table}_table.views, '${sql_obj[i].table}' AS category, (SELECT COUNT(*)  FROM comment_table WHERE comment_table.item_pk=${sql_obj[i].table}_table.pk AND comment_table.category_pk=${sql_obj[i].category_num}) AS comment_num, user_table.nickname FROM ${sql_obj[i].table}_table LEFT JOIN user_table ON ${sql_obj[i].table}_table.user_pk=user_table.pk `;
            if (keyword) {
                sql += ` WHERE (${sql_obj[i].table}_table.title LIKE "%${keyword}%" OR user_table.nickname LIKE "%${keyword}%")`;
            }

            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result_ = (await when(sql_list));
        let result = [];
        for (var i = 0; i < result_.length; i++) {
            result = [...result, ...(await result_[i])?.data ?? []];
        }

        result = await result.sort(function (a, b) {
            let x = a.date.toLowerCase();
            let y = b.date.toLowerCase();
            if (x > y) {
                return -1;
            }
            if (x < y) {
                return 1;
            }
            return 0;
        });
        let maxPage = makeMaxPage(result.length, page_cut);
        let result_obj = {};
        if (page) {
            result = result.slice((page - 1) * page_cut, (page) * page_cut)
            result_obj = { data: result, maxPage: maxPage };
        } else {
            result_obj = result;
        }
        return response(req, res, 100, "success", result_obj);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
function getDateRangeData(param1, param2) {  //param1은 시작일, param2는 종료일이다.
    var res_day = [];
    var ss_day = new Date(param1);
    var ee_day = new Date(param2);
    var _mon_ = (ss_day.getMonth() + 1);
    var month = _mon_ < 10 ? '0' + _mon_ : _mon_;
    while (ss_day.getTime() <= ee_day.getTime()) {
        var _mon_ = (ss_day.getMonth() + 1);
        _mon_ = _mon_ < 10 ? '0' + _mon_ : _mon_;
        var _day_ = ss_day.getDate();
        _day_ = _day_ < 10 ? '0' + _day_ : _day_;
        let current_flag = ss_day.getFullYear() + '-' + _mon_ + '-' + _day_ <= returnMoment().substring(0, 10);
        if (month == _mon_ && current_flag) {
            res_day.push(ss_day.getFullYear() + '-' + _mon_ + '-' + _day_);
        }
        ss_day.setDate(ss_day.getDate() + 1);
    }
    return res_day;
}
const getUserStatistics = async (req, res) => {
    try {
        let { page, page_cut, year, month, type } = req.query;
        if (!page_cut) {
            page_cut = 15;
        }
        let dates = [];
        let format = '';
        if (type == 'month') {
            let last_month = 0;
            if (returnMoment().substring(0, 4) == year) {
                last_month = parseInt(returnMoment().substring(5, 7));
            } else {
                last_month = 12;
            }
            for (var i = 1; i <= last_month; i++) {
                dates.push(`${year}-${i < 10 ? `0${i}` : i}`);
            }
            format = '%Y-%m';
        } else {

            dates = getDateRangeData(new Date(`${year}-${month < 10 ? `0${month}` : `${month}`}-01`), new Date(`${year}-${month < 10 ? `0${month}` : `${month}`}-31`));
            format = '%Y-%m-%d';
        }
        dates = dates.reverse();
        let date_index_obj = {};
        for (var i = 0; i < dates.length; i++) {
            date_index_obj[dates[i]] = i;
        }
        let sql_list = [];
        let sql_obj = [
            { table: 'user', date_colomn: 'user_date', count_column: 'user_count' },
            { table: 'oneword', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'oneevent', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'theme', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'strategy', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'issue', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'feature', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'video', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'notice', date_colomn: 'post_date', count_column: 'post_count' },
            { table: 'comment', date_colomn: 'comment_date', count_column: 'comment_count' },
        ]
        let subStr = ``;
        if (type == 'day') {
            subStr = ` WHERE SUBSTR(DATE, 1, 7)='${year + `-${month < 10 ? `0${month}` : month}`}' `;
        } else if (type == 'month') {
            subStr = ` WHERE SUBSTR(DATE, 1, 4)='${year}' `;
        } else {
            return response(req, res, -100, "fail", [])
        }
        for (var i = 0; i < sql_obj.length; i++) {
            let sql = "";

            sql = `SELECT DATE_FORMAT(date, '${format}') AS ${sql_obj[i].date_colomn}, COUNT(DATE_FORMAT(date, '${format}')) AS ${sql_obj[i].count_column} FROM ${sql_obj[i].table}_table ${subStr} GROUP BY DATE_FORMAT(date, '${format}') ORDER BY ${sql_obj[i].date_colomn} DESC`;
            sql_list.push(queryPromise(sql_obj[i].table, sql));
        }
        for (var i = 0; i < sql_list.length; i++) {
            await sql_list[i];
        }
        let result = (await when(sql_list));
        let result_list = [];
        for (var i = 0; i < dates.length; i++) {
            result_list.push({
                date: dates[i],
                user_count: 0,
                visit_count: 0,
                post_count: 0,
                comment_count: 0,
                views_count: 0
            })
        }

        for (var i = 0; i < result.length; i++) {
            let date_column = ``;
            let count_column = ``;
            if ((await result[i])?.table == 'user') {
                date_column = `user_date`;
                count_column = `user_count`;
            } else if ((await result[i])?.table == 'comment') {
                date_column = `comment_date`;
                count_column = `comment_count`;
            } else if ((await result[i])?.table == 'views') {
                date_column = `views_date`;
                count_column = `views_count`;
            } else if ((await result[i])?.table == 'visit') {
                date_column = `visit_date`;
                count_column = `visit_count`;
            } else {
                date_column = `post_date`;
                count_column = `post_count`;
            }
            let data_list = (await result[i])?.data;
            if (data_list.length > 0) {
                for (var j = 0; j < data_list.length; j++) {
                    result_list[date_index_obj[data_list[j][date_column]]][count_column] += data_list[j][count_column]
                }
            }

        }
        let maxPage = makeMaxPage(result_list.length, page_cut);
        let result_obj = {};
        if (page) {
            result_list = result_list.slice((page - 1) * page_cut, (page) * page_cut)
            result_obj = { data: result_list, maxPage: maxPage };
        } else {
            result_obj = result_list;
        }
        return response(req, res, 100, "success", result_obj);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", []);
    }
}

const getOptionObjBySchema = async (schema, whereStr) => {
    let obj = {};
    if (schema == 'subscribe') {
        let sql = ` ${sqlJoinFormat(schema, ``, "", `SELECT COUNT(*) AS people_num, SUM(${schema}_table.price) AS sum_price FROM ${schema}_table `)?.page_sql} ${whereStr} AND ${schema}_table.transaction_status >= 0`;
        let option = await dbQueryList(sql);
        option = option?.result[0];
        let sql2 = ` ${sqlJoinFormat(schema, ``, "", `SELECT COUNT(*) AS people_num, SUM(${schema}_table.price) AS sum_price FROM ${schema}_table `)?.page_sql} ${whereStr} AND ${schema}_table.transaction_status < 0 `;
        let cancel_people = await dbQueryList(sql2);
        cancel_people = cancel_people?.result[0];
        obj = {
            people_num: { title: '총 수강인원', content: commarNumber(((option?.people_num ?? 0) - (cancel_people?.people_num ?? 0))) },
        }
        if (!whereStr.includes('status=0')) {
            obj.sum_price = { title: '총 결제금액', content: commarNumber(((option?.sum_price ?? 0) + (cancel_people?.sum_price ?? 0))) }
        }
    }
    return obj;
}
const getTableName = (table) => {
    if (table == 'pay')
        return 'v_pay'
    else if (table == 'contract')
        return 'v_contract'
    else
        return `${table}_table`;
}
const getItems = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0);
        let { level, category_pk, status, user_pk, keyword, limit, page, page_cut, order, table, master_pk, difficulty, academy_category_pk, price_is_minus, start_date, end_date, type, is_my, contract_pk, is_contract, pay_category } = (req.query.table ? { ...req.query } : undefined) || (req.body.table ? { ...req.body } : undefined);
        let table_name = getTableName(table);
        let sql = `SELECT * FROM ${table_name} `;
        let pageSql = `SELECT COUNT(*) FROM ${table_name} `;
        let keyword_columns = getKewordListBySchema(table);
        let whereStr = " WHERE 1=1 ";
        if (level) {
            whereStr += ` AND ${table_name}.user_level=${level} `;
        }
        if (category_pk) {
            whereStr += ` AND ${table_name}.category_pk=${category_pk} `;
        }
        if (status) {
            whereStr += ` AND ${table_name}.status=${status} `;
        }
        if (contract_pk) {
            whereStr += ` AND contract_pk=${contract_pk} `;
        }
        if (type) {
            whereStr += ` AND ${table_name}.type=${type} `;
        }
        if (user_pk) {
            whereStr += ` AND ${table_name}.user_pk=${user_pk} `;
        }
        if (master_pk) {
            whereStr += ` AND ${table_name}.master_pk=${master_pk} `;
        }
        if (academy_category_pk) {
            whereStr += ` AND ${table_name}.academy_category_pk=${academy_category_pk} `;
        }
        if (difficulty) {
            whereStr += ` AND ${table_name}.difficulty=${difficulty} `;
        }
        if (pay_category) {
            whereStr += ` AND ${table_name}.pay_category=${pay_category} `;
        }
        if (price_is_minus) {
            whereStr += ` AND ${table_name}.transaction_status ${price_is_minus == 1 ? ' = -1 ' : ' = 0 '} `;
        }
        if (is_contract) {
            if (is_contract == 1) {
                whereStr += ` AND ${table_name}.landlord_appr=1 AND ${table_name}.lessee_appr=1  `;
            } else {
                whereStr += ` AND ( ${table_name}.landlord_appr!=1 OR ${table_name}.lessee_appr!=1 )  `;
            }
        }
        if (start_date && end_date) {
            whereStr += ` AND (${table_name}.date BETWEEN '${start_date} 00:00:00' AND '${end_date} 23:59:59' )`;
        }

        if (keyword) {
            if (keyword_columns?.length > 0) {
                whereStr += " AND (";
                for (var i = 0; i < keyword_columns.length; i++) {
                    whereStr += ` ${i != 0 ? 'OR' : ''} ${keyword_columns[i]} LIKE '%${keyword}%' `;
                }
                whereStr += ")";
            }
        }
        if (!page_cut) {
            page_cut = 15;
        }

        sql = await sqlJoinFormat(table, sql, order, pageSql).sql;
        pageSql = await sqlJoinFormat(table, sql, order, pageSql).page_sql;
        order = await sqlJoinFormat(table, sql, order, pageSql).order;
        whereStr = await sqlJoinFormat(table, sql, order, pageSql, whereStr, decode).where_str;
        pageSql = pageSql + whereStr;
        sql = sql + whereStr + ` ORDER BY ${order ? order : 'sort'} DESC `;

        if (limit && !page) {
            sql += ` LIMIT ${limit} `;
        }
        if (page) {
            sql += ` LIMIT ${(page - 1) * page_cut}, ${page_cut}`;
            let get_result = await getItemsReturnBySchema(sql, pageSql, table, req?.body);
            let page_result = get_result?.page_result;
            let result = get_result?.result;

            let want_use_count = ['user', 'comment'];
            result = await listFormatBySchema(table, result, decode);
            let maxPage = page_result[0]['COUNT(*)'] % page_cut == 0 ? (page_result[0]['COUNT(*)'] / page_cut) : ((page_result[0]['COUNT(*)'] - page_result[0]['COUNT(*)'] % page_cut) / page_cut + 1);
            let option_obj = await getOptionObjBySchema(table, whereStr);
            if (want_use_count.includes(table)) {
                option_obj['result_count'] = {
                    title: '검색결과 수',
                    content: commarNumber(page_result[0]['COUNT(*)'])
                }
            }
            return response(req, res, 100, "success", { data: result, maxPage: maxPage, option_obj: option_obj });

        } else {
            let get_result = await getItemsReturnBySchema(sql, pageSql, table, req?.body);
            let result = get_result?.result;
            result = await listFormatBySchema(table, result, decode);
            return response(req, res, 100, "success", result);
        }
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const editContract = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let {
            realtor_id,
            landlord_id,
            lessee_id,
            landlord_appr,
            lessee_appr,
            zip_code,
            address,
            address_detail,
            pay_type,
            deposit,
            monthly,
            start_date,
            end_date,
            pay_day,
            pk
        } = req.body;
        let body = {
            realtor_id,
            landlord_id,
            lessee_id,
            landlord_appr,
            lessee_appr,
            zip_code,
            address,
            address_detail,
            pay_type,
            deposit,
            monthly,
            start_date,
            end_date,
            pay_day,
            pk
        };
        let { edit_category } = req.params;
        let users = await dbQueryList(`SELECT pk, id, user_level FROM user_table`);
        users = users?.result;
        let user_obj = {};
        for (var i = 0; i < users.length; i++) {
            user_obj[users[i]?.id] = users[i];
        }
        if (!user_obj[realtor_id] || user_obj[realtor_id]?.user_level != 10) {
            return response(req, res, -100, "공인중개사 아이디를 찾을 수 없습니다.", [])
        } else {
            delete body['realtor_id'];
            body['realtor_pk'] = user_obj[realtor_id]?.pk;
        }
        if (!user_obj[landlord_id] || user_obj[landlord_id]?.user_level != 5) {
            return response(req, res, -100, "임대인 아이디를 찾을 수 없습니다.", [])
        } else {
            delete body['landlord_id'];
            body['landlord_pk'] = user_obj[landlord_id]?.pk;
        }
        if (!user_obj[lessee_id] || user_obj[lessee_id]?.user_level != 0) {
            return response(req, res, -100, "임차인 아이디를 찾을 수 없습니다.", [])
        } else {
            delete body['lessee_id'];
            body['lessee_pk'] = user_obj[lessee_id]?.pk;
        }
        delete body['pk'];
        let sql = "";
        let keys = Object.keys(body);
        let values = [];
        for (var i = 0; i < keys.length; i++) {
            values.push(body[keys[i]]);
        }
        if (edit_category == 'add') {
            let questions = [];
            for (var i = 0; i < keys.length; i++) {
                questions.push('?');
            }
            sql = ` INSERT INTO contract_table (${keys.join()}) VALUES (${questions.join()}) `;
        } else {
            values.push(req.body.pk);
            sql = ` UPDATE contract_table SET ${keys.join('=?, ')}=? WHERE pk=?`;
        }
        await db.beginTransaction();
        let result = await insertQuery(sql, values);

        if (body['landlord_appr'] == 1 && body['lessee_appr'] == 1) {
            if (req.body.pk) {
                body['pk'] = req.body.pk;
            } else {
                body['pk'] = result?.result?.insertId;
            }
            let contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${body['pk']}`);
            contract = contract?.result[0];
            await initialPay(contract);
        }
        await db.commit();
        return response(req, res, 100, "success", []);
    } catch (err) {
        await db.rollback();
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const editPay = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let {
            contract_pk,
            pay_category,
            price,
            day,
            status,
            pk,
        } = req.body;
        let body = {
            contract_pk,
            pay_category,
            price,
            day,
            status,
            pk,
        };
        let { edit_category } = req.params;
        let contract = await dbQueryList(`SELECT * FROM contract_table WHERE pk=${contract_pk}`);
        if (contract?.result.length == 0) {
            return response(req, res, -100, "존재하지 않는 계약고유번호 입니다.", [])
        }
        contract = contract?.result[0];
        delete body['pk'];
        body['realtor_pk'] = contract['realtor_pk'];
        body['landlord_pk'] = contract['landlord_pk'];
        body['lessee_pk'] = contract['lessee_pk'];
        let sql = "";
        let keys = Object.keys(body);
        let values = [];
        for (var i = 0; i < keys.length; i++) {
            values.push(body[keys[i]]);
        }
        if (edit_category == 'add') {
            let questions = [];
            for (var i = 0; i < keys.length; i++) {
                questions.push('?');
            }
            sql = ` INSERT INTO pay_table (${keys.join()}) VALUES (${questions.join()}) `;
        } else {
            values.push(req.body.pk);
            sql = ` UPDATE pay_table SET ${keys.join('=?, ')}=? WHERE pk=?`;
        }
        let result = await insertQuery(sql, values);
        return response(req, res, 100, "success", []);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getItemsReturnBySchema = async (sql_, pageSql_, schema_, body_) => {
    let sql = sql_;
    let pageSql = pageSql_;
    let schema = schema_;
    let body = body_;
    let another_get_item_schema = ['user_statistics'];
    let page_result = [{ 'COUNT(*)': 0 }];
    let result = [];
    if (another_get_item_schema.includes(schema)) {
        if (schema == 'user_statistics') {
            let { statistics_type, statistics_year, statistics_month, page_cut, page } = body;
            statistics_month = statistics_month ?? 1;
            statistics_type = statistics_type ?? 'month';
            statistics_year = statistics_year ?? returnMoment().substring(0, 4);
            let dates = [];
            let format = '';
            if (statistics_type == 'month') {
                let last_month = 0;
                if (returnMoment().substring(0, 4) == statistics_year) {
                    last_month = parseInt(returnMoment().substring(5, 7));
                } else {
                    last_month = 12;
                }
                for (var i = 1; i <= last_month; i++) {
                    dates.push(`${statistics_year}-${i < 10 ? `0${i}` : i}`);
                }
                format = '%Y-%m';
            } else {
                dates = getDateRangeData(new Date(`${statistics_year}-${statistics_month < 10 ? `0${statistics_month}` : `${statistics_month}`}-01`), new Date(`${statistics_year}-${statistics_month < 10 ? `0${statistics_month}` : `${statistics_month}`}-31`));
                format = '%Y-%m-%d';
            }
            dates = dates.reverse();
            let date_index_obj = {};
            for (var i = 0; i < dates.length; i++) {
                date_index_obj[dates[i]] = i;
            }
            let sql_list = [];
            let sql_obj = [
                { table: 'user', date_colomn: 'user_date', count_column: 'user_count' },
                { table: 'academy', date_colomn: 'post_date', count_column: 'post_count' },
                { table: 'notice', date_colomn: 'post_date', count_column: 'post_count' },
                { table: 'comment', date_colomn: 'comment_date', count_column: 'comment_count' },
            ]
            let subStr = ``;
            if (statistics_type == 'day') {
                subStr = ` WHERE SUBSTR(DATE, 1, 7)='${statistics_year + `-${statistics_month < 10 ? `0${statistics_month}` : statistics_month}`}' `;
            } else if (statistics_type == 'month') {
                subStr = ` WHERE SUBSTR(DATE, 1, 4)='${statistics_year}' `;
            } else {
                return response(req, res, -100, "fail", [])
            }
            for (var i = 0; i < sql_obj.length; i++) {
                let sql = "";
                sql = `SELECT DATE_FORMAT(date, '${format}') AS ${sql_obj[i].date_colomn}, COUNT(DATE_FORMAT(date, '${format}')) AS ${sql_obj[i].count_column} FROM ${sql_obj[i].table}_table ${subStr} GROUP BY DATE_FORMAT(date, '${format}') ORDER BY ${sql_obj[i].date_colomn} DESC`;
                sql_list.push(queryPromise(sql_obj[i].table, sql));
            }
            for (var i = 0; i < sql_list.length; i++) {
                await sql_list[i];
            }
            result = (await when(sql_list));
            let result_list = [];
            for (var i = 0; i < dates.length; i++) {
                result_list.push({
                    date: dates[i],
                    user_count: 0,
                    visit_count: 0,
                    post_count: 0,
                    comment_count: 0,
                    views_count: 0
                })
            }

            for (var i = 0; i < result.length; i++) {
                let date_column = ``;
                let count_column = ``;
                if ((await result[i])?.table == 'user') {
                    date_column = `user_date`;
                    count_column = `user_count`;
                } else if ((await result[i])?.table == 'comment') {
                    date_column = `comment_date`;
                    count_column = `comment_count`;
                } else if ((await result[i])?.table == 'views') {
                    date_column = `views_date`;
                    count_column = `views_count`;
                } else if ((await result[i])?.table == 'visit') {
                    date_column = `visit_date`;
                    count_column = `visit_count`;
                } else {
                    date_column = `post_date`;
                    count_column = `post_count`;
                }
                let data_list = (await result[i])?.data;
                if (data_list.length > 0) {
                    for (var j = 0; j < data_list.length; j++) {
                        result_list[date_index_obj[data_list[j][date_column]]][count_column] += data_list[j][count_column]
                    }
                }

            }
            let maxPage = makeMaxPage(result_list.length, page_cut);
            page_result = [{ 'COUNT(*)': result_list.length }];
            let result_obj = {};
            if (page) {
                result_list = result_list.slice((page - 1) * page_cut, (page) * page_cut)
                result_obj = { data: result_list, maxPage: maxPage };
            } else {
                result_obj = result_list;
            }
            result = result_list;
        }
    } else {
        page_result = await dbQueryList(pageSql);
        page_result = page_result?.result;
        result = await dbQueryList(sql);
        result = result?.result;
    }
    return {
        page_result: page_result,
        result: result
    }
}
const getMyItems = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let { table, page, page_cut } = req.body;
        let data = [];
        let data_length = 0;
        if (page) {
            data_length = await dbQueryList(`SELECT COUNT(*) FROM ${table}_table WHERE user_pk=${decode?.pk}`);
            data_length = data_length?.result[0]['COUNT(*)'];
        }
        let sql = `SELECT * FROM ${table}_table `;
        sql = await myItemSqlJoinFormat(table, sql).sql;
        sql += ` WHERE ${table}_table.user_pk=${decode?.pk} ORDER BY pk DESC `
        sql += (page ? `LIMIT ${(page - 1) * page_cut}, ${(page) * page_cut}` : ``)

        data = await dbQueryList(sql);
        data = data?.result;
        let maxPage = await makeMaxPage(data_length, page_cut);
        return response(req, res, 100, "success", { maxPage: maxPage, data: data });
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}

const getMyItem = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        let { table, pk } = req.body;
        let data = {};
        let sql = `SELECT * FROM ${table}_table WHERE user_pk=${decode?.pk} AND pk=${pk}`;
        data = await dbQueryList(sql);
        data = data?.result[0];
        return response(req, res, 100, "success", data);
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
function addDays(date, days) {
    const clone = new Date(date);
    clone.setDate(date.getDate() + days)
    return clone;
}
const onSubscribe = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "회원전용 메뉴입니다.", []);
        }
        let { item_pk, type_num, bag_pk } = req.body;
        if (type_num == 1) {
            return response(req, res, -100, "잘못된 접근 입니다.", []);
        }

        let bag_content = {};
        if (bag_pk) {
            bag_content = await dbQueryList(`SELECT * FROM subscribe_table WHERE pk=${bag_pk}`);
            bag_content = bag_content?.result[0];
            item_pk = bag_content?.academy_category_pk;
            type_num = 1;
        }
        let is_already_bag = await dbQueryList(`SELECT * FROM subscribe_table WHERE user_pk=${decode?.pk} AND status=0 AND academy_category_pk=${item_pk} AND end_date >= '${returnMoment().substring(0, 10)}'`);
        is_already_bag = is_already_bag?.result;
        if (is_already_bag.length > 0) {
            return response(req, res, -100, "이미 담긴 상품 입니다.", []);
        }
        let is_already_subscribe = await dbQueryList(`SELECT * FROM subscribe_table WHERE user_pk=${decode?.pk} AND status=1 AND academy_category_pk=${item_pk} AND end_date >= '${returnMoment().substring(0, 10)}'`);
        is_already_subscribe = is_already_subscribe?.result;
        if (is_already_subscribe.length > 0) {
            return response(req, res, -100, "현재 이용중인 구독상품 입니다.", []);
        }
        let item = await dbQueryList(`SELECT * FROM academy_category_table WHERE pk=${item_pk}`);
        item = item?.result[0];
        if (!item?.pk) {
            return response(req, res, -100, "잘못된 구독상품 입니다.", []);
        }
        if (item?.is_deadline == 1) {
            return response(req, res, -100, "마감된 상품 입니다.", []);
        }
        let master = await dbQueryList(`SELECT * FROM user_table WHERE pk=${item?.master_pk}`);
        master = master?.result[0];
        let today = new Date();
        let period = addDays(today, item?.period);
        period = returnMoment(period);
        await db.beginTransaction();
        let keys = ['user_pk', 'master_pk', 'academy_category_pk', 'end_date', 'status'];
        let keys_q = [];
        for (var i = 0; i < keys.length; i++) {
            keys_q.push('?');
        }
        let values = [decode?.pk, master?.pk, item?.pk, period, type_num];
        if (type_num == 1) {
            keys.push('price');
            keys_q.push('?');
            values.push((item?.price ?? 0) * ((100 - item?.discount_percent) / 100));
        }
        let result = undefined;
        if (bag_pk) {
            result = insertQuery(`UPDATE subscribe_table SET status=1, price=? WHERE pk=?`, [((item?.price ?? 0) * ((100 - item?.discount_percent) / 100)), bag_pk])
        } else {
            result = insertQuery(`INSERT INTO subscribe_table (${keys.join()}) VALUES (${keys_q.join()})`, values);
        }
        await db.commit();
        return response(req, res, 100, "success", []);

    } catch (err) {
        await db.rollback();
        console.log(err);
        return response(req, res, -200, "서버 에러 발생", [])
    }
}


const updateSubscribe = async (req, res) => {
    try {

    } catch (err) {
        await db.rollback();
        console.log(err);
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getSetting = (req, res) => {
    try {
        db.query("SELECT * FROM setting_table ORDER BY pk DESC LIMIT 1", (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", result[0])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const deleteItem = (req, res) => {
    try {
        let pk = req.body.pk ?? 0;
        let table = req.body.table ?? "";
        let sql = `DELETE FROM ${table}_table WHERE pk=? `
        db.query(sql, [pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const addSetting = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 25)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const image = '/image/' + req.file.fieldname + '/' + req.file.filename;
        db.query("INSERT INTO setting_table (main_img) VALUES (?)", [image], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateSetting = (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", [])
        }
        const { pk, file2_link, banner_2_status } = req.body;
        let image1 = "";
        let image2 = "";
        let sql = ""
        let values = [];
        sql = "UPDATE setting_table SET file2_link=?, banner_2_status=?,";
        values.push(file2_link);
        values.push(banner_2_status);
        if (req.files?.content) {
            image1 = '/image/' + req?.files?.content[0]?.fieldname + '/' + req?.files?.content[0]?.filename;
            sql += " main_img=?,";
            values.push(image1);
        }
        if (req.files?.content2) {
            image2 = '/image/' + req?.files?.content2[0]?.fieldname + '/' + req?.files?.content2[0]?.filename;
            sql += " banner_2_img=?,";
            values.push(image2);
        }
        sql = sql.substring(0, sql.length - 1);
        sql += " WHERE pk=? ";
        values.push(pk);
        db.query(sql, values, (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })

    }
    catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const updateStatus = (req, res) => {
    try {
        const { table, pk, num, column } = req.body;
        db.query(`UPDATE ${table}_table SET ${column}=? WHERE pk=? `, [num, pk], (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                return response(req, res, 100, "success", [])
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const onTheTopItem = (req, res) => {
    try {
        const { table, pk } = req.body;
        db.query(`SHOW TABLE STATUS LIKE '${table}_table' `, async (err, result1) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                let ai = result1[0].Auto_increment;
                await db.query(`UPDATE ${table}_table SET sort=? WHERE pk=? `, [ai, pk], async (err, result2) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버 에러 발생", [])
                    } else {
                        await db.query(`ALTER TABLE ${table}_table AUTO_INCREMENT=?`, [ai + 1], (err, result3) => {
                            if (err) {
                                console.log(err)
                                return response(req, res, -200, "서버 에러 발생", [])
                            } else {
                                return response(req, res, 100, "success", [])
                            }
                        })
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const changeItemSequence = (req, res) => {
    try {
        const { pk, sort, table, change_pk, change_sort } = req.body;
        let date = new Date();
        date = parseInt(date.getTime() / 1000);

        let sql = `UPDATE ${table}_table SET sort=${change_sort} WHERE pk=?`;
        let settingSql = "";
        if (sort > change_sort) {
            settingSql = `UPDATE ${table}_table SET sort=sort+1 WHERE sort < ? AND sort >= ? AND pk!=? `;
        } else if (change_sort > sort) {
            settingSql = `UPDATE ${table}_table SET sort=sort-1 WHERE sort > ? AND sort <= ? AND pk!=? `;
        } else {
            return response(req, res, -100, "둘의 값이 같습니다.", [])
        }
        db.query(sql, [pk], async (err, result) => {
            if (err) {
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", [])
            } else {
                await db.query(settingSql, [sort, change_sort, pk], async (err, result) => {
                    if (err) {
                        console.log(err)
                        return response(req, res, -200, "서버 에러 발생", [])
                    } else {
                        return response(req, res, 100, "success", [])
                    }
                })
            }
        })
    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}
const getCountNotReadNoti = async (req, res) => {
    try {
        const { pk, mac_adress } = req.body;
        let notice_ai = await getTableAI("notice").result - 1;
        let alarm_ai = await getTableAI("alarm").result - 1;
        let mac = mac_adress;
        if (!pk && !mac_adress) {
            mac = await new Promise((resolve, reject) => {
                macaddress.one(function (err, mac) {
                    if (err) {
                        console.log(err)
                        reject({
                            code: -200,
                            result: ""
                        })
                    }
                    else {
                        resolve({
                            code: 200,
                            result: mac
                        })
                    }
                })
            })
            mac = mac.result;
        }
        if (pk) {
            db.query("SELECT * FROM user_table WHERE pk=?", [pk], (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    return response(req, res, 100, "success", { item: result[0], notice_ai: notice_ai, alarm_ai: alarm_ai })
                }
            })
        } else if (mac) {
            db.query("SELECT * FROM mac_check_noti_table WHERE mac_address=?", [mac], async (err, result) => {
                if (err) {
                    console.log(err)
                    return response(req, res, -200, "서버 에러 발생", [])
                } else {
                    if (result.length > 0) {
                        return response(req, res, 100, "success", { mac: result[0], notice_ai: notice_ai, alarm_ai: alarm_ai })
                    } else {
                        await db.query("INSERT INTO mac_check_noti_table (mac_address) VALUES (?)", [mac], (err, result) => {
                            if (err) {
                                console.log(err)
                                return response(req, res, -200, "서버 에러 발생", [])
                            } else {
                                return response(req, res, 100, "success", { item: { mac_address: mac, last_alarm_pk: 0, last_notice_pk: 0 }, notice_ai: notice_ai, alarm_ai: alarm_ai })
                            }
                        })
                    }
                }
            })
        }

    } catch (err) {
        console.log(err)
        return response(req, res, -200, "서버 에러 발생", [])
    }
}





function excelDateToJSDate(serial) {
    var utc_days = Math.floor(serial - 25569);
    var utc_value = utc_days * 86400;
    var date_info = new Date(utc_value * 1000);

    var fractional_day = serial - Math.floor(serial) + 0.0000001;

    var total_seconds = Math.floor(86400 * fractional_day);

    var seconds = total_seconds % 60;

    total_seconds -= seconds;

    var hours = Math.floor(total_seconds / (60 * 60));
    var minutes = Math.floor(total_seconds / 60) % 60;

    return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}
const insertUserMoneyByExcel = async (req, res) => {
    try {
        const decode = checkLevel(req.cookies.token, 40);
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다", []);
        }
        let { list } = req.body;
        console.log(list)
        let log_obj = [];
        let user_list_sql = `SELECT pk, id FROM user_table WHERE id IN (`;
        for (var i = 0; i < list.length; i++) {
            user_list_sql += `'${list[i][0]}',`
        }
        user_list_sql = user_list_sql.substring(0, user_list_sql.length - 1);
        user_list_sql += ")";
        let user_list = await dbQueryList(user_list_sql);

        user_list = user_list?.result;

        let user_obj = {};
        for (var i = 0; i < user_list.length; i++) {
            user_obj[user_list[i]['id']] = user_list[i];
        }

        let class_list = await dbQueryList(`SELECT * FROM academy_category_table ORDER BY pk DESC`);
        class_list = class_list.result;
        let class_obj = {};
        for (var i = 0; i < class_list.length; i++) {
            class_obj[class_list[i]['title']] = class_list[i];
        }
        let insert_list = [];
        if (list.length > 0) {
            for (var i = 0; i < list.length; i++) {
                let user_pk = 0;
                let item_pk = 0;
                let master_pk = 0;
                let price = 0;
                let status = 1;
                let date = '';
                let type = 0;
                let transaction_status = 0;
                if (user_obj[list[i][0]]) {
                    user_pk = user_obj[list[i][0]]?.pk;
                } else {
                    return response(req, res, -100, `${list[i][0]} 아이디를 찾을 수 없습니다.`, []);
                }
                if (class_obj[list[i][1]]) {
                    item_pk = class_obj[list[i][1]]?.pk;
                    master_pk = class_obj[list[i][1]]?.master_pk;
                } else {
                    return response(req, res, -100, `${list[i][1]} 강의를 찾을 수 없습니다.`, []);
                }

                let date_regex = RegExp(/^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/);

                if (!date_regex.test(list[i][4])) {
                    return response(req, res, -100, `${list[i][4]} 는 등록일 정규식에 맞지 않습니다.`, []);
                } else {
                    date = list[i][4] + ' 00:00:00';
                }
                if (typeof list[i][2] == 'string') {
                    list[i][2] = list[i][2].replaceAll(',', '');
                }
                if (typeof list[i][3] == 'string') {
                    list[i][3] = list[i][3].replaceAll(',', '');
                }
                if ((list[i][2] && isNaN(parseInt(list[i][2]))) && (list[i][3] && isNaN(parseInt(list[i][3])))) {
                    return response(req, res, -100, `승인금액 또는 취소금액에 숫자 이외의 값이 감지 되었습니다.`, []);
                }
                if ((list[i][2] && parseInt(list[i][2]) > 0) && (list[i][3] && parseInt(list[i][3]) > 0)) {
                    return response(req, res, -100, `승인금액과 취소금액은 동시에 올릴 수 없습니다.`, []);
                }
                if (parseInt(list[i][2]) < 0 || parseInt(list[i][3]) < 0) {
                    return response(req, res, -100, `승인금액과 취소금액에 음수를 넣을 수 없습니다.`, []);
                }
                if (list[i][2] && parseInt(list[i][2]) > 0) {
                    price = parseInt(list[i][2]);
                    transaction_status = 0;
                }
                if (list[i][3] && parseInt(list[i][3]) > 0) {
                    price = parseInt(list[i][3]) * (-1);
                    transaction_status = -1;
                }
                let pay_type_list = ['카드결제', '무통장입금', '기타'];
                if (!pay_type_list.includes(list[i][5])) {
                    return response(req, res, -100, `결제타입에 카드결제, 무통장입금, 기타 중 하나를 입력해주세요`, []);
                } else {
                    for (var j = 0; j < pay_type_list.length; j++) {
                        if (list[i][5] == pay_type_list[j]) {
                            type = j;
                        }
                    }
                }
                insert_list.push([
                    user_pk,
                    item_pk,
                    master_pk,
                    price,
                    status,
                    date,
                    type,
                    transaction_status
                ])
            }
            await db.beginTransaction();
            let result = await insertQuery(`INSERT INTO subscribe_table (user_pk, academy_category_pk, master_pk, price, status, trade_date, type, transaction_status) VALUES ? `, [insert_list]);
            await db.commit();
            return response(req, res, 100, "success", []);
        } else {
            await db.commit();
            return response(req, res, 100, "success", []);
        }
    } catch (err) {
        console.log(err)
        await db.rollback();
        return response(req, res, -200, "서버 에러 발생", []);
    } finally {

    }
}

const isOrdered = async (decode, item) => {
    let is_already_subscribe = await dbQueryList(`SELECT * FROM subscribe_table WHERE user_pk=${decode?.pk} AND status=1 AND academy_category_pk=${item?.pk} AND end_date >= '${returnMoment().substring(0, 10)}' AND use_status=1 AND transaction_status >= 0 `);
    is_already_subscribe = is_already_subscribe?.result;
    console.log(is_already_subscribe)
    return is_already_subscribe.length > 0 ? true : false;
}

const orderInsert = async (decode, body, params) => {
    let result = { 'code': -1, 'obj': {} };
    try {
        let item = await dbQueryList(`SELECT * FROM academy_category_table WHERE pk=${params?.pk}`);
        item = item?.result[0];
        if (item?.is_deadline == 1) {
            result['code'] = 0;
            result['obj']['message'] = '마감된 상품입니다.';
            return result;
        }
        let is_already_subscribe = await isOrdered(decode, item);

        if (!is_already_subscribe) {
            let price = (item?.price ?? 0) * (100 - item?.discount_percent ?? 0) / 100;
            let { data: resp } = await axios.post('https://divecebu.co.kr/divecebu/api/aynil/approval.php', { ...body, ...params, allat_amt: price });
            result['obj'] = resp;

            if (resp?.result == '0000') {
                let trade_date = resp?.data?.approval_ymdhms;
                trade_date = `${trade_date.slice(0, 4)}-${trade_date.slice(4, 6)}-${trade_date.slice(6, 8)} ${trade_date.slice(8, 10)}:${trade_date.slice(10, 12)}:${trade_date.slice(12, 14)}`;
                let keys = {
                    price: resp?.data?.amt,
                    status: 1,
                    user_pk: decode?.pk,
                    master_pk: item?.master_pk,
                    academy_category_pk: item?.pk,
                    end_date: item?.end_date,
                    card_num: "",
                    card_name: resp?.data?.card_nm,
                    trade_date: trade_date,
                    installment: parseInt(resp?.data?.sell_mm),
                    order_num: resp?.data?.order_no,
                    approval_num: resp?.data?.approval_no
                };
                await db.beginTransaction();
                let delete_bag_result = await insertQuery(`DELETE FROM subscribe_table WHERE user_pk=? AND status=0 AND academy_category_pk=?`, [decode?.pk, item?.pk]);
                let insert_perchase_result = await insertQuery(`INSERT INTO subscribe_table (${Object.keys(keys).join()}) VALUES (${Object.keys(keys).map(() => { return "?" })})`, Object.values(keys));
                await db.commit();
                result['code'] = 1;
                result['obj']['message'] = '성공적으로 구매 되었습니다.';
            } else {
                await db.rollback();
                result['code'] = -2;
                result['obj']['message'] = resp?.message;
            }
        } else {
            await db.rollback();
            result['code'] = 0;
            result['obj']['message'] = '현재 이용중인 구독상품 입니다.'
        }
    } catch (err) {
        await db.rollback();
        console.log(err)
        result['code'] = -1;
        result['obj']['message'] = err;
    }
    return result;
}
const onKeyrecieve = async (req, res) => {
    let body = { ...req.body };


    body['allat_result_msg'].CharSet = 'euc-kr';
    if (body['allat_enc_data']) {
        body['allat_enc_data'].CharSet = 'euc-kr';
    }
    let js = `<script>
    if(window.opener != undefined)
    {
        opener.result_submit('${body?.allat_result_cd}', '${body?.allat_result_msg}', '${body?.allat_enc_data}');
        window.close();
    }
    else
        parent.result_submit('${body?.allat_result_cd}', '${body?.allat_result_msg}', '${body?.allat_enc_data}');
    </script>`;
    try {
        const decode = checkLevel(req.cookies.token, 0)
        if (!decode) {
            return response(req, res, -150, "권한이 없습니다.", []);
        } else {
            let params = { ...req.params };
            if (body?.allat_result_cd == '0000') {
                let result = await orderInsert(decode, body, params);
            }
        }
        res.send(js);
    }
    catch (err) {
        res.send(js);
    }

}


const onNotiKiwoom = (req, res) => {
    try {
        let { PAYMETHOD, CPID, DAOUTRX, ORDERNO, AMOUNT, PRODUCTNAME, SETTDATE, AUTHNO, RESERVEDSTRING, CARDCODE, CARDNAME, CARDNO } = req.query;
        console.log(req.query);
        res.send("success");
    } catch (err) {
        console.log(err);
    }
}

module.exports = {
    onLoginById, getUserToken, onLogout, checkExistId, checkPassword, checkExistIdByManager, checkExistNickname, sendSms, kakaoCallBack, editMyInfo, uploadProfile, onLoginBySns, getMyInfo,//auth
    getUsers, getItems, getSetting, getVideo, onSearchAllItem, findIdByPhone, findAuthByIdAndPhone, getComments, getCommentsManager, getCountNotReadNoti, getNoticeAndAlarmLastPk, getAllPosts, getUserStatistics, addImageItems,//select
    onSignUp, addItem, addItemByUser, addNoteImage, addSetting, addComment, addAlarm, addPopup, insertUserMoneyByExcel,//insert 
    updateUser, updateItem, updateSetting, updateStatus, onTheTopItem, changeItemSequence, changePassword, updateComment, updateAlarm, updatePopup,//update
    deleteItem, onResign, getMyItems, getMyItem, onSubscribe, updateSubscribe, getHeaderContent, onKeyrecieve, onNotiKiwoom, editContract, editPay, getGenealogy
};