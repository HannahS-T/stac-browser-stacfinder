/**
 * CQL2 Builder for Collections API
 * 
 * Builds CQL2-Text filter expressions compatible with the backend parser.
 * Currently supports text fields with comparison operators.
 * Will be extended for array fields (IN) and timestamps (BETWEEN).
 */

export default class CollectionCql {
  constructor() {
    /**
     * Array of filter objects
     * @type {Array<Object>}
     */
    this.filters = [];
  }

  /**
   * Add a comparison filter for text fields
   * 
   * Supported operators:
   * - '=' : Exact match
   * - '!=' : Not equal
   * - 'LIKE' : Pattern match (case-insensitive, adds wildcards)
   * 
   * @param {string} field - Field name from queryables
   * @param {string} operator - Comparison operator
   * @param {string} value - Value to compare
   * @returns {CollectionCql} this (for chaining)
   */
  addComparison(field, operator, value) {
    this.filters.push({
      type: 'comparison',
      field,
      operator,
      value
    });
    return this;
  }

  /**
   * Build CQL2-Text expression
   * 
   * Combines all filters with AND operator.
   * Single filter: no parentheses
   * Multiple filters: wrapped in parentheses
   * 
   * @returns {string} CQL2-Text expression (empty string if no filters)
   */
  toText() {
    if (this.filters.length === 0) {
      return '';
    }

    // Build individual filter expressions
    const expressions = this.filters.map(filter => {
      return this._buildComparison(filter);
    });

    // Single filter: no parentheses needed
    if (expressions.length === 1) {
      return expressions[0];
    }

    // Multiple filters: wrap in parentheses and join with AND
    return expressions.map(e => `(${e})`).join(' AND ');
  }

  /**
   * Build comparison expression
   */
  _buildComparison(filter) {
    const { field, operator, value } = filter;
    const escapedValue = this._escapeValue(value);

    // LIKE operator: add wildcards for pattern matching
    // Backend converts to ILIKE (case-insensitive)
    if (operator.toUpperCase() === 'LIKE') {
      return `${field} LIKE '%${escapedValue}%'`;
    }

    // Standard comparison: field operator 'value'
    return `${field} ${operator} '${escapedValue}'`;
  }

  /**
   * Escape single quotes for SQL
   * @param {*} value - Value to escape
   * @returns {string} Escaped string
   */
  _escapeValue(value) {
    return String(value).replace(/'/g, "''");
  }

  /**
   * Check if any filters are active
   * @returns {boolean} True if filters exist
   */
  hasFilters() {
    return this.filters.length > 0;
  }

  /**
   * Clear all filters
   * @returns {CollectionCql} this (for chaining)
   */
  clear() {
    this.filters = [];
    return this;
  }

  /**
   * Get number of active filters
   * @returns {number} Filter count
   */
  get filterCount() {
    return this.filters.length;
  }
}