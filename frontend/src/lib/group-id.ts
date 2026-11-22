/** 校验 8 位群组 ID：首位非 0 */
export function isValidGroupId(id: string): boolean {
  return /^[1-9]\d{7}$/.test(id)
}

/** 生成一个未被占用的 8 位群组 ID（首位非 0，纯随机） */
export function generateGroupId(isTaken: (id: string) => boolean): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    let id = String(1 + Math.floor(Math.random() * 9))
    for (let i = 0; i < 7; i++) {
      id += String(Math.floor(Math.random() * 10))
    }
    if (!isTaken(id)) return id
  }
  throw new Error('无法生成唯一的群组 ID，请重试')
}
