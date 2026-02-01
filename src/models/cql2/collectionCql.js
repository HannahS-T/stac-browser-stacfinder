/**
 * CQL2 Builder for Collections API
 * 
 * Builds CQL2-Text filter expressions compatible with the backend parser.
 * Supports:
 * - Text fields: =, !=, LIKE
 * - Array fields: IN
 * - Timestamp fields: <, >, BETWEEN
 * - Logical operators: AND, OR
 */

export default class CollectionCql {
  constructor() {
    /**
     * Array of filter objects
     * @type {Array<Object>}
     */
    this.filters = [];
    
    /**
     * Logical operator for combining filters ('and' or 'or')
     * @type {string}
     */
    this.logicalOperator = 'and';
  }

  /**
   * Set the logical operator for combining filters
   * @param {string} operator - 'and' or 'or'
   * @returns {CollectionCql} this (for chaining)
   */
  setLogicalOperator(operator) {
    if (operator === 'and' || operator === 'or') {
      this.logicalOperator = operator;
    }
    return this;
  }

  /**
   * Add a comparison filter for text or timestamp fields
   * 
   * Text fields - Supported operators:
   * - '=' : Exact match
   * - '!=' : Not equal
   * - 'LIKE' : Pattern match (case-insensitive, adds wildcards)
   * 
   * Timestamp fields - Supported operators:
   * - '<' : Before date
   * - '>' : After date
   * - '=' : Exact date (not implemented)
   * - '!=' : Not equal to date (not implemented)
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
   * Add a BETWEEN filter for timestamp fields
   * 
   * Backend expects: field BETWEEN 'low' AND 'high'
   * Backend converts to: field BETWEEN 'low'::timestamptz AND 'high'::timestamptz
   * 
   * @param {string} field - Timestamp field name (temporal_start, temporal_end)
   * @param {string} low - ISO 8601 datetime string (start of range)
   * @param {string} high - ISO 8601 datetime string (end of range)
   * @returns {CollectionCql} this (for chaining)
   */
  addBetween(field, low, high) {
    if (!low || !high) {
      console.warn(`addBetween called with empty low or high value for field ${field}`);
      return this;
    }

    this.filters.push({
      type: 'between',
      field,
      low,
      high
    });
    return this;
  }

/**
 * Add a spatial filter for more refined bounding box searches
 * 
 * @param {string} spatialRelation - Spatial relation type (e.g., 'intersects', 'contains', 'within', 'overlaps')
 * @param {string} bbox - Bounding box coordinates in the format 'minX,minY,maxX,maxY'
 * @returns {CollectionCql} this (for chaining)
 */
  addSpatial(spatialRelation, bbox) {
    this.filters.push({
      type: 'spatial',
      spatialRelation,
      bbox
    });
    return this;
  }


  /**
   * Build CQL2-Text expression
   * 
   * Combines all filters with the configured logical operator (AND/OR).
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
      } else if (filter.type === 'between') {
        return this._buildBetween(filter);
      } else if (filter.type === 'spatial') {
        return this._buildSpatial(filter);
      }
      throw new Error(`Unknown filter type: ${filter.type}`);
    });

    // Single filter: no parentheses needed
    if (expressions.length === 1) {
      return expressions[0];
    }

    // Multiple filters: wrap in parentheses and join with logical operator
    const logicalOp = this.logicalOperator.toUpperCase(); // 'AND' or 'OR'
    return expressions.map(e => `(${e})`).join(` ${logicalOp} `);
  }

  /**
   * Build comparison expression
   * @private
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
   * 
   * @private
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
   * Build BETWEEN expression for timestamp fields
   * 
   * CQL2-Text format: field BETWEEN 'low' AND 'high'
   * Backend parses and converts to: field BETWEEN 'low'::timestamptz AND 'high'::timestamptz
   * 
   * @private
   */
  _buildBetween(filter) {
    const { field, low, high } = filter;

    // Escape values (though ISO 8601 shouldn't have quotes)
    const escapedLow = this._escapeValue(low);
    const escapedHigh = this._escapeValue(high);

    // Format: field BETWEEN 'low' AND 'high'
    return `${field} BETWEEN '${escapedLow}' AND '${escapedHigh}'`;
  }

  /**
   * Build spatial expression
   * @private
   */
  _buildSpatial(filter) {
    const { spatialRelation, bbox } = filter;
    return `S_${spatialRelation.toUpperCase()}(spatial_extent, BBOX(${bbox}))`;
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