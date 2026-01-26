/**
 * CQL2 Builder for Collections API
 * 
 * Builds CQL2-Text filter expressions compatible with the backend parser.
 * Supports:
 * - Text fields: =, !=, LIKE
 * - Array fields: IN (field IN ('value1', 'value2'))
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
   * Add an IN filter for array fields
   * 
   * Backend expects: field IN ('value1', 'value2', 'value3')
   * Backend converts to: field && ARRAY['value1', 'value2', 'value3']
   * 
   * @param {string} field - Array field name from queryables
   * @param {Array<string>} values - Array of values to match
   * @returns {CollectionCql} this (for chaining)
   */
  addIn(field, values) {
    if (!Array.isArray(values) || values.length === 0) {
      console.warn(`addIn called with empty or non-array values for field ${field}`);
      return this;
    }

    this.filters.push({
      type: 'in',
      field,
      values: values.filter(v => v !== null && v !== undefined && v !== '')
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
      if (filter.type === 'comparison') {
        return this._buildComparison(filter);
      } else if (filter.type === 'in') {
        return this._buildIn(filter);
      }
      throw new Error(`Unknown filter type: ${filter.type}`);
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
   * Build IN expression for array fields
   * 
   * CQL2-Text format: field IN ('value1', 'value2', 'value3')
   * Backend parses and converts to: field && ARRAY['value1', 'value2', 'value3']
   */
  _buildIn(filter) {
    const { field, values } = filter;

    if (values.length === 0) {
      return '';
    }

    // Escape and quote each value
    const quotedValues = values.map(value => {
      const escapedValue = this._escapeValue(value);
      return `'${escapedValue}'`;
    });

    // Format: field IN ('value1', 'value2', 'value3')
    return `${field} IN (${quotedValues.join(', ')})`;
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