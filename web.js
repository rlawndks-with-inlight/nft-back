const fs = require('fs')
const express = require('express')
const app = express()
const mysql = require('mysql')
const cors = require('cors')
const db = require('./config/db')
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const port = 8001;
app.use(cors());
require('dotenv').config()
const im = require('imagemagick');
const sharp = require('sharp')
//passport, jwt
const jwt = require('jsonwebtoken')
const { checkLevel, logRequestResponse, isNotNullOrUndefined,
        namingImagesPath, nullResponse, lowLevelResponse, response,
        returnMoment, sendAlarm, categoryToNumber, tooMuchRequest,
        getEnLevelByNum } = require('./util')
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
//multer
const { upload } = require('./config/multerConfig')
//express
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(passport.initialize());
// app.use(passport.session());
// passportConfig(passport);
const schedule = require('node-schedule');

const path = require('path');
const { insertQuery } = require('./query-util')
const { getItem } = require('./routes/common')
const { objFormatBySchema } = require('./format/formats')
app.set('/routes', __dirname + '/routes');
app.use('/config', express.static(__dirname + '/config'));
//app.use('/image', express.static('./upload'));
app.use('/image', express.static(__dirname + '/image'));
app.use('/api', require('./routes/router'))

app.get('/', (req, res) => {
        console.log("back-end initialized")
        res.send('back-end initialized')
});
const is_test = true;
app.connectionsN = 0;
const HTTP_PORT = 8001;
const HTTPS_PORT = 8443;


const dbQueryList = (sql, list) => {
        return new Promise((resolve, reject) => {
                db.query(sql, list, (err, result, fields) => {
                        if (err) {
                                console.log(sql)
                                console.log(err)
                                reject({
                                        code: -200,
                                        result: result
                                })
                        }
                        else {
                                resolve({
                                        code: 200,
                                        result: result
                                })
                        }
                })
        })
}

let time = new Date(returnMoment()).getTime();
let overFiveTime = new Date(returnMoment());
overFiveTime.setMinutes(overFiveTime.getMinutes() + 5)
overFiveTime = overFiveTime.getTime();

const scheduleSystem = () => {
        let use_alarm = false;
        let use_auction = true;
        schedule.scheduleJob('0 0/1 * * * *', async function () {
                let return_moment = returnMoment()
                console.log(return_moment)
                if (use_alarm) {
                        let date = return_moment.substring(0, 10);
                        let dayOfWeek = new Date(date).getDay()
                        let result = await dbQueryList(`SELECT * FROM alarm_table WHERE ((DATEDIFF(?, start_date) >= 0 AND days LIKE '%${dayOfWeek}%' AND type=1) OR ( start_date=? AND type=2 )) AND STATUS=1`, [date, date]);
                        if (result.code > 0) {
                                let list = [...result.result];
                                for (var i = 0; i < list.length; i++) {
                                        let time = new Date(return_moment).getTime();
                                        let overFiveTime = new Date(return_moment);
                                        overFiveTime.setMinutes(overFiveTime.getMinutes() + 1)
                                        overFiveTime = overFiveTime.getTime();

                                        let item_time = new Date(return_moment.substring(0, 11) + list[i].time).getTime();

                                        if (item_time >= time && item_time < overFiveTime) {
                                                sendAlarm(list[i].title, list[i].note, "alarm", list[i].pk, list[i].url);
                                                insertQuery("INSERT INTO alarm_log_table (title, note, item_table, item_pk, url) VALUES (?, ?, ?, ?, ?)", [list[i].title, list[i].note, "alarm", list[i].pk, list[i].url])
                                        }
                                }
                        }
                }
                if (use_auction) {
                        if (return_moment.includes('11:59:00')) {//매일 11:59시
                                deadlineAuction(return_moment);
                        }
                }
        })

}
const deadlineAuction = async (return_moment) => {
        let items = await dbQueryList(`SELECT *, 0 AS max_price, 0 AS winner_pk FROM item_table WHERE type=1 AND owner_pk=0 AND end_date<='${return_moment.substring(0, 10)}' ORDER BY pk ASC`);
        items = items?.result;
        let items_obj = {};
        for (var i = 0; i < items.length; i++) {
                items_obj[items[i]?.pk] = items[i];
        }
        if (items.length > 0) {
                let item_pk_list = items.map(item => {
                        return item?.pk
                })
                let auction_hitory = await dbQueryList(`SELECT * FROM auction_table WHERE item_pk IN (${item_pk_list.join()})`);
                auction_hitory = auction_hitory?.result;
                for (var i = 0; i < auction_hitory.length; i++) {
                        if (items_obj[auction_hitory[i]?.item_pk]?.max_price < auction_hitory[i]?.price) {
                                items_obj[auction_hitory[i]?.item_pk]['max_price'] = auction_hitory[i]?.price;
                                items_obj[auction_hitory[i]?.item_pk]['winner_pk'] = auction_hitory[i]?.user_pk;
                        }
                }
                console.log(items_obj)
                let sql_list = [];
                for (var i = 0; i < items.length; i++) {
                        if (items_obj[items[i]?.pk]?.winner_pk > 0 && items_obj[items[i]?.pk]?.max_price > 0) {
                                sql_list.push({
                                        item_pk: items[i]?.pk,
                                        user_pk: items_obj[items[i]?.pk]?.winner_pk
                                })
                        }

                }
                for (var i = 0; i < sql_list.length; i++) {
                        let result = await insertQuery(`UPDATE item_table SET owner_pk=? WHERE pk=?`,[sql_list[i].user_pk,sql_list[i].item_pk,]);
                }
        }
}

let server = undefined
if (is_test) {
        server = http.createServer(app).listen(HTTP_PORT, function () {
                console.log("Server on " + HTTP_PORT)
                //scheduleSystem();
        });

} else {
        const options = { // letsencrypt로 받은 인증서 경로를 입력해 줍니다.
                ca: fs.readFileSync("/etc/letsencrypt/live/purplevery19.cafe24.com/fullchain.pem"),
                key: fs.readFileSync("/etc/letsencrypt/live/purplevery19.cafe24.com/privkey.pem"),
                cert: fs.readFileSync("/etc/letsencrypt/live/purplevery19.cafe24.com/cert.pem")
        };
        server = https.createServer(options, app).listen(HTTPS_PORT, function () {
                console.log("Server on " + HTTPS_PORT);
                scheduleSystem();
        });

}
server.on('connection', function (socket) {
        // Increase connections count on newly estabilished connection
        app.connectionsN++;

        socket.on('close', function () {
                // Decrease connections count on closing the connection
                app.connectionsN--;
        });
});
const resizeFile = async (path, filename) => {
        try {
                // await sharp(path + '/' + filename)
                //         .resize(64, 64)
                //         .jpeg({quality:100})
                //         .toFile(path + '/' + filename.substring(3, filename.length))
                //        await fs.unlink(path + '/' + filename, (err) => {  // 원본파일 삭제 
                //                 if (err) {
                //                     console.log(err)
                //                     return
                //                 }
                //             })
                fs.rename(path + '/' + filename, path + '/' + filename.replaceAll('!@#', ''), function (err) {
                        if (err) throw err;
                        console.log('File Renamed!');
                });
        } catch (err) {
                console.log(err)
        }
}
// fs.readdir('./image/profile', async (err, filelist) => {
//         if (err) {
//                 console.log(err);
//         } else {
//                 for (var i = 0; i < filelist.length; i++) {
//                         if (filelist[i].includes('!@#')) {
//                                 await resizeFile('./image/profile', filelist[i]);
//                         }
//                 }
//         }
// });

// Default route for server status

app.get('/api/item', async (req, res) => {
        try {
                // if (tooMuchRequest(app.connectionsN)) {
                //          return response(req, res, -120, "접속자 수가 너무많아 지연되고있습니다.(잠시후 다시 시도 부탁드립니다.)", [])
                //  }
                let table = req.query.table ?? "user";
                //console.log(table)
                const pk = req.query.pk ?? 0;
                const community_list = ['faq', 'notice'];
                const only_my_item = ['pay', 'contract'];
                const decode = checkLevel(req.cookies.token, 0)
                if (!decode) {
                        return response(req, res, -150, "권한이 없습니다.", []);
                }

                await db.beginTransaction();
                if (community_list.includes(table)) {
                        let community_add_view = await insertQuery(`UPDATE ${table}_table SET views=views+1 WHERE pk=?`, [pk]);
                }
                if (only_my_item.includes(table)) {
                        table = `v_${table}`;
                } else {
                        table = `${table}_table`;
                }
                let sql = `SELECT * FROM ${table} WHERE pk=${pk}`;
                let item = await dbQueryList(sql);
                item = item?.result[0];

                if (only_my_item.includes(table)) {
                        if (decode?.user_level < 40) {
                                if (item[`${getEnLevelByNum(decode?.user_level)}_pk`] != decode?.pk) {
                                        await db.rollback();
                                        return response(req, res, -150, "권한이 없습니다.", []);
                                }
                        }
                }
                item = await objFormatBySchema(table, item, decode);
                return response(req, res, 100, "success", item);
        }
        catch (err) {
                await db.rollback();
                console.log(err)
                return response(req, res, -200, "서버 에러 발생", []);
        }
});
app.get('/', (req, res) => {
        res.json({ message: `Server is running on port ${req.secure ? HTTPS_PORT : HTTP_PORT}` });
});
