/** 用户名：2–20 位，可包含中文、字母、数字、下划线 */
export const USERNAME_RE = /^[一-龥a-zA-Z0-9_]{2,20}$/

/** 密码：至少 6 位 */
export const MIN_PASSWORD_LENGTH = 6

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 群组名称：1–20 个字符 */
export const MAX_GROUP_NAME_LENGTH = 20
