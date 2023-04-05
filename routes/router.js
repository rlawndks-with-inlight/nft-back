const express = require('express');
const router = express.Router();
const { upload } = require('../config/multerConfig')
const {
    onLoginById, getUserToken, onLogout, checkExistId, checkPassword, checkExistIdByManager, checkExistNickname, sendSms, kakaoCallBack, editMyInfo, uploadProfile, onLoginBySns, getMyInfo,//auth
    getUsers, getItems, getSetting, getVideo, onSearchAllItem, findIdByPhone, findAuthByIdAndPhone, getComments, getCommentsManager, getCountNotReadNoti, getNoticeAndAlarmLastPk, getAllPosts, getUserStatistics, addImageItems,//select
    onSignUp, addItem, addItemByUser, addNoteImage, addSetting, addComment, addAlarm, addPopup, insertUserMoneyByExcel,//insert 
    updateUser, updateItem, updateSetting, updateStatus, onTheTopItem, changeItemSequence, changePassword, updateComment, updateAlarm, updatePopup,//update
    deleteItem, onResign, getMyItems, getMyItem, onSubscribe, updateSubscribe, getHeaderContent, onKeyrecieve, onNotiKiwoom, editContract, editPay, getGenealogy
} = require('./common');
const {
    addContract, getHomeContent, updateContract, requestContractAppr, confirmContractAppr,
    onResetContractUser, onChangeCard, getCustomInfo, getMyPays, addHeart, deleteHeart, getProduct,
    addAuction, deleteAuction, getDashBoard, onBuy
} = require('./user');
const image_list = [
    { name: 'master' },
    { name: 'master2' },
    { name: 'content' },
    { name: 'content1' },
    { name: 'content2' },
    { name: 'content3' },
    { name: 'content4' },
    { name: 'content5' },
    { name: 'popup' },
    { name: 'profile' },
    { name: 'ad' },
    { name: 'note' },
    { name: 'document_src' },
]
router.post('/addimageitems', upload.fields(image_list), addImageItems);
router.post('/insertusermoneybyexcel', insertUserMoneyByExcel);
router.post('/addalarm', addAlarm);
router.post('/updatealarm', updateAlarm);
router.post('/editmyinfo', editMyInfo);
router.post('/uploadprofile', upload.single('profile'), uploadProfile)
router.post('/kakao/callback', kakaoCallBack);
router.post('/sendsms', sendSms);
router.post('/findidbyphone', findIdByPhone);
router.post('/findauthbyidandphone', findAuthByIdAndPhone);
router.post('/checkexistid', checkExistId);
router.post('/checkpassword', checkPassword);
router.post('/checkexistidbymanager', checkExistIdByManager);
router.post('/checkexistnickname', checkExistNickname);
router.post('/changepassword', changePassword);
router.post('/adduser', onSignUp);
router.post('/loginbyid', onLoginById);
router.post('/loginbysns', onLoginBySns);
router.post('/logout', onLogout);
router.get('/auth', getUserToken);
router.get('/users', getUsers);
router.post('/additem', upload.fields([{ name: 'content' }, { name: 'content2' }]), addItem);
router.post('/additembyuser', upload.fields([{ name: 'content' }, { name: 'content2' }]), addItemByUser);
router.post('/updateitem', upload.fields([{ name: 'content' }, { name: 'content2' }]), updateItem);
router.post('/addimage', upload.single('note'), addNoteImage);
router.post('/deleteitem', deleteItem);
router.post('/resign', onResign);
router.post('/updateuser', updateUser);
router.get('/onsearchallitem', onSearchAllItem);
router.get('/items', getItems);
router.post('/items', getItems);
router.post('/myitems', getMyItems);
router.post('/myitem', getMyItem);
router.get('/getallposts', getAllPosts);
router.get('/getuserstatistics', getUserStatistics);
router.get('/gethomecontent', getHomeContent);
router.get('/getdashboard', getDashBoard);
router.get('/getheadercontent', getHeaderContent);
router.get('/getmyinfo', getMyInfo);
router.get('/customer-info', getCustomInfo);
router.post('/getgenealogy', getGenealogy);
router.post('/change-card', onChangeCard);

router.post('/keyrecieve/:pk/:device', onKeyrecieve);
router.get('/keyrecieve/:pk/:device', onKeyrecieve);

router.get('/noti/kiwoom', onNotiKiwoom);
router.post('/addcontract', addContract);
router.post('/updatecontract', updateContract);
router.post('/requestcontractappr', requestContractAppr);
router.post('/confirmcontractappr', confirmContractAppr);
router.post('/onresetcontractuser', onResetContractUser);

router.post('/updatesetting', upload.fields([{ name: 'content' }, { name: 'content2' }]), updateSetting);
router.post('/addsetting', upload.single('master'), addSetting);
router.get('/setting', getSetting);
router.post('/updatestatus', updateStatus);
//router.get('/getvideocontent', getVideoContent);
router.get('/video/:pk', getVideo);
router.post('/onthetopitem', onTheTopItem);
router.post('/changeitemsequence', changeItemSequence);
router.get('/getcommnets', getComments);
router.post('/addcomment', addComment);
router.post('/updatecomment', updateComment);
router.get('/getcommentsmanager', getCommentsManager);
router.post('/getcountnotreadnoti', getCountNotReadNoti);
router.get('/getnoticeandalarmlastpk', getNoticeAndAlarmLastPk);
router.post('/addpopup', upload.single('content'), addPopup);
router.post('/updatepopup', upload.single('content'), updatePopup);
router.post('/onsubscribe', onSubscribe);
router.post('/updatesubscribe', updateSubscribe);
router.get('/mypays', getMyPays);
router.post('/contract/:edit_category', editContract);
router.post('/pay/:edit_category', editPay);
router.post('/heart', addHeart);
router.post('/deleteheart', deleteHeart);
router.post('/auction', addAuction);
router.post('/buy', onBuy);
router.post('/deleteauction', deleteAuction);
router.get('/product', getProduct);

module.exports = router;