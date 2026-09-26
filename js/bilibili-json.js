const url = $request.url;
const method = $request.method;
const notifyTitle = "bilibili-json";
console.log(`b站json-2023.10.22 (+刷视频去广告 2026-09-27)`);
if (!$response.body) {
    // 有undefined的情况
    console.log(`$response.body为undefined:${url}`);
    $done({});
}
if (method !== "GET") {
    $notification.post(notifyTitle, "method错误:", method);
}
let body = JSON.parse($response.body);


if (!body.data) {
    console.log(url);
    console.log(`body:${$response.body}`);
    $notification.post(notifyTitle, url, "data字段错误");
} else {
    if (url.includes("x/v2/splash")) {
        console.log('开屏页' + (url.includes("splash/show") ? 'show' : 'list'));
        if (!body.data.show) {
            // 有时候返回的数据没有show字段
            console.log('数据无show字段');
        } else {
            delete body.data.show;
            console.log('成功');
        }
    } else if (url.includes("resource/show/tab/v2")) {
        console.log('tab修改');
        // 顶部右上角
        if (!body.data.top) {
            console.log(`body:${$response.body}`);
            $notification.post(notifyTitle, 'tab', "top字段错误");
        } else {
            body.data.top = body.data.top.filter(item => {
                if (item.name === '游戏中心') {
                    console.log('去除右上角游戏中心');
                    return false;
                }
                return true;
            });
            fixPos(body.data.top);
        }
        // 底部tab栏
        if (!body.data.bottom) {
            console.log(`body:${$response.body}`);
            $notification.post(notifyTitle, 'tab', "bottom字段错误");
        } else {
            body.data.bottom = body.data.bottom.filter(item => {
                if (item.name === '发布') {
                    console.log('去除发布');
                    return false;
                } else if (item.name === '会员购' || item.tab_id === '会员购Bottom') {
                    console.log('去除会员购');
                    return false;
                }
                return true;
            });
            fixPos(body.data.bottom);
        }
    } else if (url.includes("x/v2/feed/index/story")) {
        // 「刷视频」竖屏沉浸式 feed。必须排在 feed/index 分支之前，
        // 否则会被上面那条 includes("x/v2/feed/index") 抢先匹配走错逻辑。
        console.log('刷视频(竖屏story)');
        if (!Array.isArray(body.data.items)) {
            console.log(`body:${$response.body}`);
            $notification.post(notifyTitle, '刷视频', "items字段错误");
        } else {
            const adGoto = ['vertical_ad_av', 'vertical_ad_live', 'vertical_ad_picture'];
            const before = body.data.items.length;
            body.data.items = body.data.items.filter(item => {
                if (item.ad_info || !item.card_goto || adGoto.includes(item.card_goto)) {
                    return false;
                }
                // 顺带清掉购物车图标、免流提示、课程/游戏推广位
                delete item.story_cart_icon;
                delete item.free_flow_toast;
                delete item.image_infos;
                delete item.course_info;
                delete item.game_info;
                return true;
            });
            console.log(`刷视频去广告: ${before} -> ${body.data.items.length}`);
        }
    } else if (url.includes("x/v2/feed/index")) {
        console.log('推荐页');
        if (!body.data.items?.length) {
            console.log(`body:${$response.body}`);
            $notification.post(notifyTitle, '推荐页', "items字段错误");
        } else {
            body.data.items = body.data.items.filter(i => {
                const {card_type: cardType, card_goto: cardGoto} = i;
                if (cardType && cardGoto) {
                    if (cardType === 'banner_v8' && cardGoto === 'banner') {
                        if (!i.banner_item) {
                            console.log(`body:${$response.body}`);
                            $notification.post(notifyTitle, '推荐页', "banner_item错误");
                        } else {
                            for (const v of i.banner_item) {
                                if (!v.type) {
                                    console.log(`body:${$response.body}`);
                                    $notification.post(notifyTitle, '推荐页', "type错误");
                                } else {
                                    if (v.type === 'ad') {
                                        console.log('banner广告');
                                        return false;
                                    }
                                }
                            }
                        }
                    } else if (cardType === 'cm_v2' && ['ad_web_s', 'ad_av', 'ad_web_gif', 'ad_player', 'ad_inline_3d', 'ad_inline_eggs'].includes(cardGoto)) {
                        // ad_player大视频广告 ad_web_gif大gif广告 ad_web_s普通小广告 ad_av创作推广广告 ad_inline_3d  上方大的视频3d广告 ad_inline_eggs 上方大的视频广告
                        console.log(`${cardGoto}广告去除)`);
                        return false;
                    } else if (cardType === 'small_cover_v10' && cardGoto === 'game') {
                        console.log('游戏广告去除');
                        return false;
                    } else if (cardType === 'cm_double_v9' && cardGoto === 'ad_inline_av') {
                        console.log('创作推广-大视频广告');
                        return false;
                    }
                } else {
                    console.log(`body:${$response.body}`);
                    $notification.post(notifyTitle, '推荐页', "无card_type/card_goto");
                }
                return true;
            });
        }
    } else {
        $notification.post(notifyTitle, "路径匹配错误:", url);
    }
}

body = JSON.stringify(body);
$done({
    body
});


function fixPos(arr) {
    for (let i = 0; i < arr.length; i++) {
        // 修复pos
        arr[i].pos = i + 1;
    }
}
