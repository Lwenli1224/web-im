import {createReducer, createActions} from "reduxsauce"
import Immutable from "seamless-immutable"
import WebIM from "@/config/WebIM"
import CommonActions from "@/redux/CommonRedux"
import RosterActions from "@/redux/RosterRedux"
import LoginActions from "@/redux/LoginRedux"
import GroupActions from "@/redux/GroupRedux"
import ChatRoomActions from "@/redux/ChatRoomRedux"
import SubscribeActions from "@/redux/SubscribeRedux"
import BlacklistActions from "@/redux/BlacklistRedux"
import MessageActions from "@/redux/MessageRedux"
import {store} from "@/redux"
import {history} from "@/utils"
import utils from "@/utils"
import {I18n} from "react-redux-i18n"

import {message} from "antd"

WebIM.conn.listen({
    // xmpp连接成功
    onOpened: msg => {
        const username = store.getState().login.username
        const token = utils.getToken()
        const hash = utils.getHash()
        console.log(history)
        // todo 所有不需要默认登陆的path都需要配置
        const path =
            history.location.pathname.indexOf("login") !== -1
                ? "/contact"
                : history.location.pathname
        const redirectUrl = `${path}?username=${username}`

        // 出席后才能接受推送消息
        // presence to be online
        WebIM.conn.setPresence()
        // 获取好友信息
        // get roster
        store.dispatch(RosterActions.getContacts())
        // 通知登陆成功
        store.dispatch(LoginActions.setLoginSuccess())
        // 获取黑名单列表
        // store.dispatch(BlacklistActions.getBlacklist())
        // 获取群组列表
        store.dispatch(GroupActions.getGroups())
        // 获取群组列表
        store.dispatch(ChatRoomActions.getChatRooms())

        store.dispatch(LoginActions.stopLoging())
        // refresh page
        hash.indexOf(redirectUrl) === -1 && history.push(redirectUrl)
    },
    // 出席消息
    onPresence: msg => {
        console.debug("onPresence", msg, store.getState())
        switch (msg.type) {
            case "subscribe":
                // 加好友时双向订阅过程，所以当对方同意添加好友的时候
                // 会有一步对方自动订阅本人的操作，这步操作是自动发起
                // 不需要通知提示，所以此处通过state=[resp:true]标示
                if (msg.status === "[resp:true]") {
                    return
                }

                store.dispatch(SubscribeActions.addSubscribe(msg))
                break
            case "subscribed":
                store.dispatch(RosterActions.getContacts())
                // Alert.alert(msg.from + " " + I18n.t("subscribed"))
                message.warning(msg.from + "" + I18n.t("subscribed"))
                break
            case "unsubscribe": // The sender deletes a friend.
            case "unsubscribed": // The other party has removed you from the friend list.
                // 好友退订消息
                store.dispatch(RosterActions.getContacts())
                // Alert.alert(msg.from + " " + I18n.t("unsubscribed"))
                if ("code" in msg) {
                    message.warning(msg.from + " " + I18n.t("refuse"))
                } else {
                    message.warning(msg.from + " " + I18n.t("unsubscribed"))
                }
                break
        }
    },
    // 各种异常
    onError: error => {
        console.log(error)
        // 16: server-side close the websocket connection
        if (error.type == WebIM.statusCode.WEBIM_CONNCTION_DISCONNECTED) {
            console.log(
                "WEBIM_CONNCTION_DISCONNECTED",
                WebIM.conn.autoReconnectNumTotal,
                WebIM.conn.autoReconnectNumMax
            )
            if (WebIM.conn.autoReconnectNumTotal < WebIM.conn.autoReconnectNumMax) {
                return
            }
            message.error("server-side close the websocket connection")
            history.push("/login")
            return
        }
        // 2: token 登录失败
        if (error.type == WebIM.statusCode.WEBIM_CONNCTION_AUTH_ERROR) {
            message.error("WEBIM_CONNCTION_AUTH_ERROR")

            return
        }
        // 7: client-side network offline (net::ERR_INTERNET_DISCONNECTED)
        if (error.type == WebIM.statusCode.WEBIM_CONNCTION_SERVER_CLOSE_ERROR) {
            console.log("WEBIM_CONNCTION_SERVER_CLOSE_ERROR")
            //TODO 需要加判断 如果是logout 就不显示错误信息
            // message.error("client-side network offline")

            return
        }
        // 8: offline by multi login
        if (error.type == WebIM.statusCode.WEBIM_CONNCTION_SERVER_ERROR) {
            console.log("WEBIM_CONNCTION_SERVER_ERROR")
            message.error("offline by multi login")
            history.push("/login")
            return
        }
        if (error.type == 1) {
            let data = error.data ? error.data.data : ""
            data && message.error(data)
            store.dispatch(LoginActions.loginFailure(error))
        }
    },
    // 连接断开
    onClosed: msg => {
        console.log("onClosed", msg)
        // msg.msg && message.error(msg.msg)
        store.dispatch(Creators.logoutSuccess())
    },
    // 更新黑名单
    onBlacklistUpdate: list => {
        store.dispatch(BlacklistActions.updateBlacklist(list))
    },
    // 文本信息
    onTextMessage: message => {
        console.log("onTextMessage", message)
        store.dispatch(MessageActions.addMessage(message, "txt"))
    },
    onPictureMessage: message => {
        console.log("onPictureMessage", message)
        store.dispatch(MessageActions.addMessage(message, "img"))
    }
})

/* ------------- Types and Action Creators ------------- */

const {Types, Creators} = createActions({
    logoutSuccess: null,
    signin: null,

    // ----------------async------------------
    // 登出
    logout: () => {
        return (dispatch, state) => {
            let I18N = store.getState().i18n.translations[
                store.getState().i18n.locale
                ]
            message.success(I18N.logoutSuccessfully)
            dispatch(CommonActions.fetching())
            if (WebIM.conn.isOpened()) {
                WebIM.conn.close("logout")
            }
        }
    }
})

export const WebIMTypes = Types
export default Creators

/* ------------- Initial State ------------- */

export const INITIAL_STATE = Immutable({
    msgs: {}
})

/* ------------- Reducers ------------- */

export const logoutSuccess = state => {
    console.log("logoutSuccess", state)
    history.push("/login")
    return state
}

export const signin = state => {
    history.push("/login")
    return state
}

/* ------------- Hookup Reducers To Types ------------- */

export const reducer = createReducer(INITIAL_STATE, {
    [Types.LOGOUT_SUCCESS]: logoutSuccess,
    [Types.SIGNIN]: signin
})

/* ------------- Selectors ------------- */

// Is the current user logged in?
// export const isLoggedIn = (loginState: Object) => loginState.username !== null

/** Constants: Connection Status Constants
 *  Connection status constants for use by the connection handler
 *  callback.
 *
 *  Status.ERROR - An error has occurred
 *  Status.CONNECTING - The connection is currently being made
 *  Status.CONNFAIL - The connection attempt failed
 *  Status.AUTHENTICATING - The connection is authenticating
 *  Status.AUTHFAIL - The authentication attempt failed
 *  Status.CONNECTED - The connection has succeeded
 *  Status.DISCONNECTED - The connection has been terminated
 *  Status.DISCONNECTING - The connection is currently being terminated
 *  Status.ATTACHED - The connection has been attached
 *  Status.CONNTIMEOUT - The connection has timed out
 */
