// @ts-nocheck
/**
 * Definiciones de tipos y estructuras globales (JSDoc compatible con navegadores y Vite)
 * @typedef {Object} Transaction
 * @property {number} [id]
 * @property {number} amount
 * @property {string} date
 * @property {string} type
 * @property {string} category
 * @property {string} [notes]
 * @property {number} [accountId]
 *
 * @typedef {Object} Account
 * @property {number} [id]
 * @property {string} name
 * @property {string} type
 * @property {number} balance
 *
 * @typedef {Object} Budget
 * @property {number} [id]
 * @property {string} category
 * @property {number} limit
 * @property {number} spent
 *
 * @typedef {Object} GoalContribution
 * @property {number} [id]
 * @property {number} [goal_id]
 * @property {number} amount
 * @property {string} date
 * @property {string|null} [note]
 * @property {number|null} [account_id]
 * @property {'deposit'|'withdraw'} [type]
 *
 * @typedef {Object} Goal
 * @property {number} id
 * @property {string} name
 * @property {string} cat
 * @property {string} [emoji]
 * @property {string} color
 * @property {number} target
 * @property {number} current
 * @property {string|null} [deadline]
 * @property {string|null} [start_date]
 * @property {string} [currency]
 * @property {string|null} [notes]
 * @property {string} [status]
 * @property {string|null} [created_at]
 * @property {GoalContribution[]} [contributions]
 *
 * @typedef {Object} ShoppingListItem
 * @property {string} id
 * @property {string} name
 * @property {string} [quantity]
 * @property {string} [category]
 * @property {boolean} completed
 * @property {string} [notes]
 * @property {number} [estimatedPrice]
 * @property {string} addedAt
 */

export const TYPES_LOADED = true;
