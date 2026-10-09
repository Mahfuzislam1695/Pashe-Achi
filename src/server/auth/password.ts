import bcrypt from 'bcryptjs'

const COST = 12

export const hashPassword = (password: string) => bcrypt.hash(password, COST)

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

/**
 * A real hash to compare against when the account doesn't exist, so a login for an unknown
 * mobile number takes as long as one with a wrong password.
 */
export const DUMMY_HASH = bcrypt.hashSync('pashe-achi-timing-guard', COST)
