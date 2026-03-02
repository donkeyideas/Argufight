/**
 * Input validation utilities for security
 */

/**
 * Sanitize string input - remove potentially dangerous characters
 */
export function sanitizeString(input: string, maxLength?: number): string {
  if (typeof input !== 'string') {
    return ''
  }

  // Trim whitespace
  let sanitized = input.trim()

  // Limit length if specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim().toLowerCase())
}

/**
 * List of reserved/blocked usernames that cannot be used
 * These prevent impersonation of the company, employees, or official accounts
 */
const BLOCKED_USERNAMES = new Set([
  // Admin/Official accounts
  'admin',
  'administrator',
  'admins',
  'administrators',
  'admin1',
  'admin2',
  'admin3',
  'admin4',
  'admin5',
  'admin0',
  'admin01',
  'admin02',
  'admin03',
  'admin04',
  'admin05',
  'admin10',
  'admin11',
  'admin12',
  'admin13',
  'admin14',
  'admin15',
  'admin20',
  'admin99',
  'admin100',
  'admin123',
  'admin1234',
  'admin_',
  'admin-',
  '_admin',
  '-admin',
  'admin_1',
  'admin-1',
  'admin_user',
  'admin-user',
  'user1admin',
  'useradmin',
  'user_admin',
  'user-admin',
  
  // Company/Brand names
  'argufight',
  'argu-fight',
  'argufightadmin',
  'argufight-admin',
  'argufight_admin',
  'argufightofficial',
  'argufight-official',
  'argufight_official',
  'argufightteam',
  'argufight-team',
  'argufight_team',
  'argufightstaff',
  'argufight-staff',
  'argufight_staff',
  'argufightsupport',
  'argufight-support',
  'argufight_support',
  'argufighthelp',
  'argufight-help',
  'argufight_help',
  'honorableai',
  'honorable-ai',
  'honorable_ai',
  'honorableaiadmin',
  'honorable-ai-admin',
  'honorable_ai_admin',
  
  // Official/Support roles
  'official',
  'officials',
  'official1',
  'official2',
  'official3',
  'official_',
  'official-',
  '_official',
  '-official',
  'support',
  'supports',
  'support1',
  'support2',
  'support3',
  'support_',
  'support-',
  '_support',
  '-support',
  'help',
  'helps',
  'help1',
  'help2',
  'help3',
  'help_',
  'help-',
  '_help',
  '-help',
  'team',
  'teams',
  'team1',
  'team2',
  'team3',
  'team_',
  'team-',
  '_team',
  '-team',
  'staff',
  'staffs',
  'staff1',
  'staff2',
  'staff3',
  'staff_',
  'staff-',
  '_staff',
  '-staff',
  'employee',
  'employees',
  'employee1',
  'employee2',
  'employee3',
  'employee_',
  'employee-',
  '_employee',
  '-employee',
  'moderator',
  'moderators',
  'moderator1',
  'moderator2',
  'moderator3',
  'moderator_',
  'moderator-',
  '_moderator',
  '-moderator',
  'mod',
  'mods',
  'mod1',
  'mod2',
  'mod3',
  'mod_',
  'mod-',
  '_mod',
  '-mod',
  
  // System/Service accounts
  'system',
  'systems',
  'system1',
  'system2',
  'system_',
  'system-',
  '_system',
  '-system',
  'service',
  'services',
  'service1',
  'service2',
  'service_',
  'service-',
  '_service',
  '-service',
  'api',
  'apis',
  'api1',
  'api2',
  'api_',
  'api-',
  '_api',
  '-api',
  'bot',
  'bots',
  'bot1',
  'bot2',
  'bot3',
  'bot_',
  'bot-',
  '_bot',
  '-bot',
  'root',
  'root1',
  'root2',
  'root_',
  'root-',
  '_root',
  '-root',
  
  // Common impersonation patterns
  'owner',
  'owners',
  'owner1',
  'owner2',
  'owner_',
  'owner-',
  '_owner',
  '-owner',
  'founder',
  'founders',
  'founder1',
  'founder2',
  'founder_',
  'founder-',
  '_founder',
  '-founder',
  'ceo',
  'ceos',
  'ceo1',
  'ceo2',
  'ceo_',
  'ceo-',
  '_ceo',
  '-ceo',
  'manager',
  'managers',
  'manager1',
  'manager2',
  'manager_',
  'manager-',
  '_manager',
  '-manager',
])

/**
 * Check if a username is blocked/reserved
 * Case-insensitive check
 */
export function isBlockedUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
    return false
  }
  
  const normalized = username.trim().toLowerCase()
  return BLOCKED_USERNAMES.has(normalized)
}

/**
 * Validate username format
 * - 3-20 characters
 * - Alphanumeric, underscore, hyphen only
 * - No spaces
 * - Not a blocked/reserved username
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== 'string') {
    return false
  }

  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/
  const isValidFormat = usernameRegex.test(username.trim())
  
  if (!isValidFormat) {
    return false
  }
  
  // Check if username is blocked
  if (isBlockedUsername(username)) {
    return false
  }
  
  return true
}

/**
 * Validate password strength
 * - At least 8 characters
 * - Contains at least one letter and one number
 */
export function isValidPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false
  }

  if (password.length < 8) {
    return false
  }

  // At least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)

  return hasLetter && hasNumber
}

/**
 * Validate debate topic
 * - 5-200 characters
 * - No HTML tags
 */
export function isValidDebateTopic(topic: string): boolean {
  if (!topic || typeof topic !== 'string') {
    return false
  }

  const trimmed = topic.trim()
  if (trimmed.length < 5 || trimmed.length > 200) {
    return false
  }

  // Check for HTML tags
  const htmlTagRegex = /<[^>]*>/g
  if (htmlTagRegex.test(trimmed)) {
    return false
  }

  return true
}

/**
 * Validate debate description
 * - Max 1000 characters
 * - No HTML tags
 */
export function isValidDebateDescription(description: string | null | undefined): boolean {
  if (!description) {
    return true // Description is optional
  }

  if (typeof description !== 'string') {
    return false
  }

  if (description.length > 1000) {
    return false
  }

  // Check for HTML tags
  const htmlTagRegex = /<[^>]*>/g
  if (htmlTagRegex.test(description)) {
    return false
  }

  return true
}

/**
 * Validate statement content
 * - 10-5000 characters
 * - No HTML tags
 */
export function isValidStatement(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false
  }

  const trimmed = content.trim()
  if (trimmed.length < 10 || trimmed.length > 5000) {
    return false
  }

  // Check for HTML tags
  const htmlTagRegex = /<[^>]*>/g
  if (htmlTagRegex.test(trimmed)) {
    return false
  }

  return true
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return ''
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }

  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Validate category name
 */
export function isValidCategoryName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false
  }

  // Uppercase, alphanumeric, underscore only
  const categoryRegex = /^[A-Z0-9_]+$/
  return categoryRegex.test(name.trim())
}
