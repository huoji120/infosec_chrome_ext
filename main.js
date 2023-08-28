// ==UserScript==
// @license      MIT
// @name         安服小助手
// @namespace    http://key08.com/
// @version      0.3
// @description  安服必备
// @author       huoji
// @match        *://*/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
    'use strict';
    function build_html (document) {
        // 创建自定义的右键菜单
        let customContextMenu = document.createElement('div');
        customContextMenu.id = 'huoji_tip_custom-context-menu';
        customContextMenu.style.display = 'none';
        customContextMenu.style.position = 'fixed';
        customContextMenu.style.zIndex = '10000';
        customContextMenu.style.backgroundColor = '#fff';
        customContextMenu.style.border = '1px solid #000';
        customContextMenu.innerHTML = '<div><button id="send-to-tip-button">进行KSN云查</button></div>' +
            '<div><button id="vt-search-button">发送到VirusTotal</button></div>' +
            '<div><button id="wb-search-button">发送到微步</button></div>' +
            '<div><button id="copy-button">复制到剪切板</button></div>' +
            '<div><button id="change-ksn-key-button">修改KSN密钥</button></div>';
        document.body.appendChild(customContextMenu);

        // 创建气泡提示
        let bubble = document.createElement('div');
        bubble.id = 'huoji_tip_bubble';
        bubble.style.display = 'none';
        bubble.style.position = 'fixed';
        bubble.style.zIndex = '10001';
        bubble.style.padding = '10px';
        bubble.style.borderRadius = '5px';
        bubble.style.color = '#fff';
        document.body.appendChild(bubble);

        // 创建加载动画
        let loader = document.createElement('div');
        loader.id = 'huoji_tip_loader';
        loader.style.display = 'none';
        loader.style.borderRadius = '50%';
        loader.style.animation = 'spin 2s linear infinite';
        loader.style.border = '8px solid #f3f3f3';  // 减小边框大小
        loader.style.borderTop = '8px solid #3498db';  // 顶部边框保持颜色，但大小减半
        loader.style.width = '60px';  // 宽度减半
        loader.style.height = '60px';  // 高度减半

        document.body.appendChild(loader);

        // 添加CSS动画
        let style = document.createElement('style');
        style.innerHTML = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        `;
        document.head.appendChild(style);
    }
    if (document == null) {
        document = window.document;
    }
    function PrintKsnResult (result, e) {
        let zone = result.zone;
        let hitcount = result.hitcount;
        switch (zone) {
            case 'Green':
                showBubble(e.pageX, e.pageY, '白文件 流行度:' + hitcount.toString(), '#888');
                break;
            case 'Yellow':
                showBubble(e.pageX, e.pageY, '广告文件 流行度:' + hitcount.toString(), '#888');
                break;
            case 'Grey':
                showBubble(e.pageX, e.pageY, '未知文件 流行度:' + hitcount.toString(), '#888');
                break;
            case 'Red':
                showBubble(e.pageX, e.pageY, '病毒文件 流行度:' + hitcount.toString(), '#f00');
                break;
        }
    }
    build_html(document);
    let ksnQueryCache = {}

    // 当用户右击页面时，如果选中的是MD5或SHA1哈希值，则显示自定义的右键菜单
    document.oncontextmenu = function (e) {

        let text = window.getSelection().toString();
        let md5Pattern = /^[a-f0-9]{32}$/i;
        let sha1Pattern = /^[a-f0-9]{40}$/i;
        let ipPattern = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        let domainPattern = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}$/i;

        let customContextMenu = document.getElementById('huoji_tip_custom-context-menu');
        let sendToTipButton = document.getElementById('send-to-tip-button');
        let copyButton = document.getElementById('copy-button');
        let vtSearchButton = document.getElementById('vt-search-button');
        let wbSearchButton = document.getElementById('wb-search-button');
        let changeKsnKeyButton = document.getElementById('change-ksn-key-button');
        let loader = document.getElementById('huoji_tip_loader');
        if (changeKsnKeyButton == null || wbSearchButton == null || vtSearchButton == null || copyButton == null || sendToTipButton == null || customContextMenu == null || loader == null) {
            build_html(document);
            return;
        }
        if (md5Pattern.test(text) || sha1Pattern.test(text) || ipPattern.test(text) || domainPattern.test(text)) {
            customContextMenu.style.left = e.pageX + 'px';
            customContextMenu.style.top = e.pageY + 'px';
            customContextMenu.style.display = 'block';

            e.preventDefault();
            if (md5Pattern.test(text) || sha1Pattern.test(text)) {
                sendToTipButton.style.display = 'block';
                vtSearchButton.style.display = 'block';
                changeKsnKeyButton.style.display = 'block';
                wbSearchButton.style.display = 'none';
            } else {
                sendToTipButton.style.display = 'none';
                vtSearchButton.style.display = 'none';
                changeKsnKeyButton.style.display = 'none';
                wbSearchButton.style.display = 'block';
            }
            sendToTipButton.onclick = function () {
                if (md5Pattern.test(text) == false && sha1Pattern.test(text) == false) {
                    alert('请输入正确的MD5或SHA1哈希值');
                    return;
                }
                let apiKey = GM_getValue('apiKey');
                if (!apiKey) {
                    apiKey = prompt("第一次使用需要填KSN密钥, 请输入您的KSN API密钥:", "");
                    GM_setValue('apiKey', apiKey);
                }
                // 显示加载动画
                loader.style.position = 'fixed';
                loader.style.left = e.clientX + 'px';  // 使用鼠标点击时的坐标
                loader.style.top = e.clientY + 'px';
                loader.style.display = 'block';
                loader.style.zIndex = '9999';
                if (text in ksnQueryCache) {
                    PrintKsnResult(ksnQueryCache[text], e);
                    loader.style.display = 'none';
                } else {
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: "https://opentip.kaspersky.com/api/v1/search/hash?request=" + text,
                        headers: {
                            "x-api-key": apiKey
                        },
                        onload: function (response) {
                            loader.style.display = 'none';

                            if (response.status === 404) {
                                showBubble(e.pageX, e.pageY, '找不到hash', '#888');
                            } else if (response.status === 200) {
                                let result = JSON.parse(response.responseText);
                                ksnQueryCache[text] = { 'zone': result.Zone, 'hitcount': result.FileGeneralInfo.HitsCount };
                                PrintKsnResult(ksnQueryCache[text], e);
                            } else if (response.status === 401) {
                                let userChoice = confirm("KSN API密钥错误,你想更换密钥吗?");
                                if (userChoice == true) {
                                    apiKey = prompt("重新输入密钥:", "");
                                    GM_setValue('apiKey', apiKey);
                                }
                            } else if (response.status === 403) {
                                let userChoice = confirm("密钥超过一天配额,换密钥或者明天再用,你想更换密钥吗?");
                                if (userChoice == true) {
                                    apiKey = prompt("重新输入密钥:", "");
                                    GM_setValue('apiKey', apiKey);
                                }
                            } else if (response.status === 400) {
                                alert('!MD5或者sha1不正确!');
                            }
                        }
                    });
                }
                customContextMenu.style.display = 'none';  // 关闭菜单
            };

            copyButton.onclick = function () {
                GM_setClipboard(text);
                customContextMenu.style.display = 'none';  // 关闭菜单
            };
            document.getElementById('vt-search-button').onclick = function () {
                if (md5Pattern.test(text) == false && sha1Pattern.test(text) == false) {
                    alert('请输入正确的MD5或SHA1哈希值');
                    return;
                }
                window.open('https://www.virustotal.com/gui/file/' + text, '_blank');
                customContextMenu.style.display = 'none';  // 关闭菜单
            };
            document.getElementById('change-ksn-key-button').onclick = function () {
                apiKey = prompt("重新输入密钥:", "");
                GM_setValue('apiKey', apiKey);
            };
            document.getElementById('wb-search-button').onclick = function () {
                if (md5Pattern.test(text) || sha1Pattern.test(text)) {
                    alert('请输入域名或者IP地址');
                    return;
                } else if (ipPattern.test(text)) {
                    window.open('https://x.threatbook.com/v5/ip/' + text, '_blank');
                } else if (domainPattern.test(text)) {
                    window.open('https://x.threatbook.com/v5/domain/' + text, '_blank');
                }
                customContextMenu.style.display = 'none';  // 关闭菜单
            };
        }
    };

    // 点击其他地方关闭菜单和气泡提示
    document.onclick = function (e) {
        if (e.target.id !== 'send-to-tip-button' && e.target.id !== 'copy-button' && e.target.id !== 'vt-search-button' && e.target.id !== 'wb-search-button') {
            let customContextMenu = document.getElementById('huoji_tip_custom-context-menu');
            if (customContextMenu) {
                customContextMenu.style.display = 'none';
            }
            let bubble = document.getElementById('huoji_tip_bubble');
            if (bubble) {
                bubble.style.display = 'none';
            }
        }
    };

    // 显示气泡提示
    function showBubble (x, y, message, color) {
        let bubble = document.getElementById('huoji_tip_bubble');
        if (bubble) {
            bubble.style.left = x + 'px';
            bubble.style.top = y + 'px';
            bubble.style.backgroundColor = color;
            bubble.textContent = message;
            bubble.style.display = 'block';
        }
    }
})();
