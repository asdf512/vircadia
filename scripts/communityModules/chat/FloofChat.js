/* globals OverlayWindow */

var ROOT = Script.resolvePath('').split("FloofChat.js")[0];
var H_KEY = 72;
var ENTER_KEY = 16777220;
var ESC_KEY = 16777216;
var CONTROL_KEY = 67108864;
var SHIFT_KEY = 33554432;
var FLOOF_CHAT_CHANNEL = "Chat";
var FLOOF_NOTIFICATION_CHANNEL = "Floof-Notif";

Script.scriptEnding.connect(function () {
    shutdown();
});

var tablet = Tablet.getTablet("com.highfidelity.interface.tablet.system");
var button = tablet.addButton({
    icon: ROOT + "chat.png",
    text: "CHAT"
});

Script.scriptEnding.connect(function () { // So if anything errors out the tablet/toolbar button gets removed!
    tablet.removeButton(button);
});

var appUUID = Uuid.generate();

var chatBar;
var chatHistory;
var historyLog = [];


var visible = false;
var historyVisible = false;
var settingsRoot = "FloofChat";

var muted = Settings.getValue(settingsRoot + "/muted", {"Local": false, "Domain": false, "Grid": false});

var ws;
var wsReady = false;
var WEB_SOCKET_URL = "ws://gridchat.darlingvr.club:8090";  // WebSocket for Grid chat.
var shutdownBool = false;

var defaultColour = {red: 255, green: 255, blue: 255};
var colours = {};
colours["localChatColour"] = Settings.getValue(settingsRoot + "/localChatColour", defaultColour);
colours["domainChatColour"] = Settings.getValue(settingsRoot + "/domainChatColour", defaultColour);
colours["gridChatColour"] = Settings.getValue(settingsRoot + "/gridChatColour", defaultColour);

init();

function init() {
    Messages.subscribe(FLOOF_CHAT_CHANNEL);
    historyLog = [];
    try {
        historyLog = JSON.parse(Settings.getValue(settingsRoot + "/HistoryLog", "[]"));
    } catch (e) {
        //
    }

    setupHistoryWindow(false);

    chatBar = new OverlayWindow({
        source: Paths.defaultScripts + '/communityModules/chat/FloofChat.qml?' + Date.now(),
        width: 360,
        height: 180
    });

    button.clicked.connect(toggleChatHistory);
    chatBar.fromQml.connect(fromQml);
    chatBar.sendToQml(JSON.stringify({visible: false}));
    Controller.keyPressEvent.connect(keyPressEvent);
    Messages.messageReceived.connect(messageReceived);

    connectWebSocket();
}

function connectWebSocket(timeout) {
    ws = new WebSocket(WEB_SOCKET_URL);
    ws.onmessage = function incoming(_data) {
        var message = _data.data;
        var cmd = {FAILED: true};
        try {
            cmd = JSON.parse(message);
        } catch (e) {
            //
        }
        if (!cmd.FAILED) {
            addToLog(cmd.message, cmd.displayName, cmd.colour, cmd.channel);
            if (!muted["Grid"]) {
                Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
                    sender: "(G) " + cmd.displayName,
                    text: replaceFormatting(cmd.message),
                    colour: {text: cmd.colour}
                }));
            }
        }
    };

    ws.onopen = function open() {
        wsReady = true;
    };

    ws.onclose = function close() {
        wsReady = false;
        console.log('disconnected');

        timeout = timeout | 0;
        if (!shutdownBool && timeout < (30 * 1000)) {
            Script.setTimeout(function () {
                connectWebSocket(timeout);
            }, timeout + 1000);
        } else {
            wsReady = -1;
        }
    };
}


function sendWS(msg, timeout) {
    if (wsReady === true) {
        ws.send(JSON.stringify(msg));
    } else {
        timeout = timeout | 0;
        if (!shutdownBool && timeout < (30 * 1000)) {
            Script.setTimeout(function () {
                if (wsReady === -1) {
                    connectWebSocket();
                }
                sendWS(msg, timeout);
            }, timeout + 1000);
        }
    }
}

function setupHistoryWindow() {
    chatHistory = new OverlayWebWindow({
        title: 'Chat',
        source: ROOT + "FloofChat.html?appUUID=" + appUUID + "&" + Date.now(),
        width: 900,
        height: 700,
        visible: false
    });
    chatHistory.setPosition({x: 0, y: Window.innerHeight - 700});
    chatHistory.webEventReceived.connect(onWebEventReceived);
    chatHistory.closed.connect(toggleChatHistory);
}

function emitScriptEvent(obj) {
    obj.appUUID = appUUID;
    tablet.emitScriptEvent(JSON.stringify(obj));
}

function toggleChatHistory() {
    historyVisible = !historyVisible;
    button.editProperties({isActive: historyVisible});
    chatHistory.visible = historyVisible;
}

function chatColour(tab) {
    if (tab === "Local") {
        return colours["localChatColour"];
    } else if (tab === "Domain") {
        return colours["domainChatColour"];
    } else if (tab === "Grid") {
        return colours["gridChatColour"];
    } else {
        return defaultColour;
    }
}

function onWebEventReceived(event) {
    event = JSON.parse(event);
    if (event.type === "ready") {
        chatHistory.emitScriptEvent(JSON.stringify({type: "MSG", data: historyLog}));
        chatHistory.emitScriptEvent(JSON.stringify({type: "CMD", cmd: "MUTED", muted: muted}));
    }
    if (event.type === "CMD") {
        if (event.cmd === "MUTED") {
            muted = event.muted;
            Settings.setValue(settingsRoot + "/muted", muted);
        }
        if (event.cmd === "COLOUR") {
            Settings.setValue(settingsRoot + "/" + event.colourType + "Colour", event.colour);
            colours[event.colourType] = event.colour;
        }
        if (event.cmd === "REDOCK") {
            chatHistory.setPosition({x: 0, y: Window.innerHeight - 700});
        }
        if (event.cmd === "GOTO") {
            var result = Window.confirm("Do you want to goto " + event.url.split("/")[2] + " ?");
            if (result) {
                location = event.url;
            }
        }
        if (event.cmd === "URL") {
            new OverlayWebWindow({
                title: 'Web',
                source: event.url,
                width: 900,
                height: 700,
                visible: true
            });
        }
        if (event.cmd === "COPY") {
            Window.copyToClipboard(event.url);
        }
    }
    if (event.type === "WEBMSG") {
        if (event.message === "") return;
        sendWS({
            uuid: "",
            type: "WebChat",
            channel: event.tab,
            colour: chatColour(event.tab),
            message: event.message,
            displayName: MyAvatar.displayName
        });
    }
    if (event.type === "MSG") {
        if (event.message === "") return;
        Messages.sendMessage("Chat", JSON.stringify({
            type: "TransmitChatMessage",
            position: MyAvatar.position,
            channel: event.tab,
            colour: chatColour(event.tab),
            message: event.message,
            displayName: MyAvatar.displayName
        }));
        setVisible(false);
    }
}

function replaceFormatting(text) {
    var found = false;
    if (text.indexOf("**") !== -1) {
        var firstMatch = text.indexOf("**") + 2;
        var secondMatch = text.indexOf("**", firstMatch);
        if (firstMatch !== -1 && secondMatch !== -1) {
            found = true;
            var part1 = text.substring(0, firstMatch - 2);
            var part2 = text.substring(firstMatch, secondMatch);
            var part3 = text.substring(secondMatch + 2);
            text = part1 + "<i>" + part2 + "</i>" + part3;
        }
    } else if (text.indexOf("*") !== -1) {
        var firstMatch = text.indexOf("*") + 1;
        var secondMatch = text.indexOf("*", firstMatch);
        if (firstMatch !== -1 && secondMatch !== -1) {
            found = true;
            var part1 = text.substring(0, firstMatch - 1);
            var part2 = text.substring(firstMatch, secondMatch);
            var part3 = text.substring(secondMatch + 1);
            text = part1 + "<b>" + part2 + "</b>" + part3;
        }
    } else if (text.indexOf("__") !== -1) {
        var firstMatch = text.indexOf("__") + 2;
        var secondMatch = text.indexOf("__", firstMatch);
        if (firstMatch !== -1 && secondMatch !== -1) {
            found = true;
            var part1 = text.substring(0, firstMatch - 2);
            var part2 = text.substring(firstMatch, secondMatch);
            var part3 = text.substring(secondMatch + 2);
            text = part1 + "<u>" + part2 + "</u>" + part3;
        }
    } else if (text.indexOf("_") !== -1) {
        var firstMatch = text.indexOf("_") + 1;
        var secondMatch = text.indexOf("_", firstMatch);
        if (firstMatch !== -1 && secondMatch !== -1) {
            found = true;
            var part1 = text.substring(0, firstMatch - 1);
            var part2 = text.substring(firstMatch, secondMatch);
            var part3 = text.substring(secondMatch + 1);
            text = part1 + "<i>" + part2 + "</i>" + part3;
        }
    } else if (text.indexOf("~~") !== -1) {
        var firstMatch = text.indexOf("~~") + 2;
        var secondMatch = text.indexOf("~~", firstMatch);
        if (firstMatch !== -1 && secondMatch !== -1) {
            found = true;
            var part1 = text.substring(0, firstMatch - 2);
            var part2 = text.substring(firstMatch, secondMatch);
            var part3 = text.substring(secondMatch + 2);
            text = part1 + "<s>" + part2 + "</s>" + part3;
        }
    }
    if (found) {
        return replaceFormatting(text);
    } else {
        return text;
    }
}

function messageReceived(channel, message) {
    if (channel === "Chat") {
        var cmd = {FAILED: true};
        try {
            cmd = JSON.parse(message);
        } catch (e) {
            //
        }
        if (!cmd.FAILED) {
            if (cmd.type === "TransmitChatMessage") {
                if (!cmd.hasOwnProperty("channel")) {
                    cmd.channel = "Domain";
                }
                if (!cmd.hasOwnProperty("colour")) {
                    cmd.colour = {red: 222, green: 222, blue: 222};
                }
                if (cmd.message.indexOf("/me") === 0) {
                    cmd.message = cmd.message.replace("/me", cmd.displayName);
                    cmd.displayName = "";
                }
                if (cmd.channel === "Local") {
                    if (Vec3.withinEpsilon(MyAvatar.position, cmd.position, 20)) {
                        addToLog(cmd.message, cmd.displayName, cmd.colour, cmd.channel);
                        if (!muted["Local"]) {
                            Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
                                sender: "(L) " + cmd.displayName,
                                text: replaceFormatting(cmd.message),
                                colour: {text: cmd.colour}
                            }));
                        }
                    }
                } else if (cmd.channel === "Domain") {
                    addToLog(cmd.message, cmd.displayName, cmd.colour, cmd.channel);
                    if (!muted["Domain"]) {
                        Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
                            sender: "(D) " + cmd.displayName,
                            text: replaceFormatting(cmd.message),
                            colour: {text: cmd.colour}
                        }));
                    }
                } else if (cmd.channel === "Grid") {
                    addToLog(cmd.message, cmd.displayName, cmd.colour, cmd.channel);
                    if (!muted["Grid"]) {
                        Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
                            sender: "(G) " + cmd.displayName,
                            text: replaceFormatting(cmd.message),
                            colour: {text: cmd.colour}
                        }));
                    }
                } else {
                    addToLog(cmd.message, cmd.displayName, cmd.colour, cmd.channel);
                    Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
                        sender: cmd.displayName,
                        text: replaceFormatting(cmd.message),
                        colour: {text: cmd.colour}
                    }));
                }
            }
        }
    }
}

function time() {
    var d = new Date();
    var h = (d.getHours()).toString();
    var m = (d.getMinutes()).toString();
    var s = (d.getSeconds()).toString();
    var h2 = ("0" + h).slice(-2);
    var m2 = ("0" + m).slice(-2);
    var s2 = ("0" + s).slice(-2);
    s2 += (d.getMilliseconds() / 1000).toFixed(2).slice(1);
    return h2 + ":" + m2 + ":" + s2;
}

function addToLog(msg, dp, colour, tab) {
    historyLog.push([time(), msg, dp, colour, tab]);
    chatHistory.emitScriptEvent(JSON.stringify({type: "MSG", data: [[time(), msg, dp, colour, tab]]}));
    while (historyLog.length > 500) {
        historyLog.shift();
    }
    Settings.setValue(settingsRoot + "/HistoryLog", JSON.stringify(historyLog))
}

function fromQml(message) {
    var cmd = {FAILED: true};
    try {
        cmd = JSON.parse(message);
    } catch (e) {
        //
    }
    if (!cmd.FAILED) {
        if (cmd.type === "MSG") {
            if (cmd.message !== "") {
                if (cmd.event.modifiers === CONTROL_KEY) {
                    Messages.sendMessage(FLOOF_CHAT_CHANNEL, JSON.stringify({
                        type: "TransmitChatMessage", channel: "Domain", colour: chatColour("Domain"),
                        message: cmd.message,
                        displayName: MyAvatar.displayName
                    }));
                } else if (cmd.event.modifiers === CONTROL_KEY + SHIFT_KEY) {
                    sendWS({
                        uuid: "",
                        type: "WebChat",
                        channel: "Grid",
                        colour: chatColour("Grid"),
                        message: cmd.message,
                        displayName: MyAvatar.displayName
                    });
                } else {
                    Messages.sendMessage(FLOOF_CHAT_CHANNEL, JSON.stringify({
                        type: "TransmitChatMessage",
                        channel: "Local",
                        position: MyAvatar.position,
                        colour: chatColour("Local"),
                        message: cmd.message,
                        displayName: MyAvatar.displayName
                    }));
                }
            }
            setVisible(false);
        } else if (cmd.type === "CMD") {
            if (cmd.cmd === "Clicked") {
                toggleChatHistory()
            }
        }
    }
}

function setVisible(_visible) {
    if (_visible) {
        Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
            type: "options",
            offset: 64
        }));
        chatBar.sendToQml(JSON.stringify({visible: true}));
    } else {
        Messages.sendLocalMessage(FLOOF_NOTIFICATION_CHANNEL, JSON.stringify({
            type: "options",
            offset: -1
        }));
        chatBar.sendToQml(JSON.stringify({visible: false}));
    }
    visible = _visible;
}

function keyPressEvent(event) {
    if (event.key === H_KEY && !event.isAutoRepeat && event.isControl) {
        toggleChatHistory()
    }
    if (event.key === ENTER_KEY && !event.isAutoRepeat && !visible) {
        setVisible(true);
    }
    if (event.key === ESC_KEY && !event.isAutoRepeat && visible) {
        setVisible(false);
    }
}

function shutdown() {
    try {
        Messages.messageReceived.disconnect(messageReceived);
    } catch (e) {
        // empty
    }
    try {
        Controller.keyPressEvent.disconnect(keyPressEvent);
    } catch (e) {
        // empty
    }
    chatBar.close();
    chatHistory.close();
}