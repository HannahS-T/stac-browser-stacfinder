/**
 * Queryable field definition for Collections API
 * 
 * Represents a filterable field with its schema and supported operators.
 * Fields are loaded from the backend's /collections/queryables endpoint.
 */

export default class CollectionQueryable {
  /**
   * Create a queryable field
   * 
   * @param {string} id - Field identifier (e.g., 'title', 'keywords', 'temporal_start')
   * @param {Object} schema - JSON Schema definition from API
   */
  constructor(id, schema) {
    this.id = id;
    this.schema = schema || {};
  }

  /**
   * Detect field type from JSON Schema
   * 
   * @returns {string} Field type
   */
  get type() {
    const schemaType = this.schema.type;
    
    // Timestamp field: string with format=date-time
    if (schemaType === 'string' && this.schema.format === 'date-time') {
      return 'timestamp';
    }
    
    // Enum field: string with predefined values 
    if (schemaType === 'string' && Array.isArray(this.schema.enum) && this.schema.enum.length > 0) {
      return 'enum';
    }
    
    // Special case: keywords is a text_array in backend but exposed as string without enum
    // LIKE is not supported for text_array, so treat it as text_array
    if (schemaType === 'string' && this.id === 'keywords') {
      return 'text_array';
    }
    
    // Text field
    if (schemaType === 'string') {
      return 'text';
    }
    
    // Array of strings (text_array)
    if (schemaType === 'array' && this.schema.items?.type === 'string') {
      return 'text_array';
    }
    
    // Number fields (e.g. gsd)
    if (schemaType === 'number') {
      return 'number';
    }
    
    // Unknown/unsupported type
    return 'unknown';
  }

  /**
   * Check if field is a text field
   * 
   * @returns {boolean}
   */
  get isText() {
    return this.type === 'text';
  }

  /**
   * Check if field is an enum field (dropdown with predefined values)
   * 
   * @returns {boolean}
   */
  get isEnum() {
    return this.type === 'enum';
  }

  /**
   * Check if field is a text array field
   * 
   * @returns {boolean}
   */
  get isTextArray() {
    return this.type === 'text_array';
  }

  /**
   * Check if field is a number field
   * 
   * @returns {boolean}
   */
  get isNumber() {
    return this.type === 'number';
  }

  /**
   * Check if field is a timestamp field
   * 
   * @returns {boolean}
   */
  get isTimestamp() {
    return this.type === 'timestamp';
  }

  /**
   * Get supported operators for this field type
   * 
   * Returns array of operator objects with:
   * - value: CQL2 operator string
   * - label: Short display label (symbol)
   * - description: i18n key for description
   * 
   * @returns {Array<Object>} Array of operator definitions
   */
  getOperators() {
    const operators = [];

    if (this.isText) {
      operators.push(
        { value: '=', label: '=', description: 'operators.equals' },
        { value: '!=', label: '≠', description: 'operators.notEquals' },
        { value: 'LIKE', label: '~', description: 'operators.contains' }
      );
    }

    if (this.isEnum) {
      operators.push(
        { value: '=', label: '=', description: 'operators.equals' },
        { value: '!=', label: '≠', description: 'operators.notEquals' },
        { value: 'IN', label: '∈', description: 'operators.containsOneOf' }
      );
    }

    if (this.isTextArray) {
      operators.push(
        { value: '=', label: '=', description: 'operators.equals' },
        { value: '!=', label: '≠', description: 'operators.notEquals' },
        { value: 'IN', label: '∈', description: 'operators.containsOneOf' }
      );
    }

    if (this.isNumber) {
      operators.push(
        { value: '=', label: '=', description: 'operators.equals' },
        { value: '!=', label: '≠', description: 'operators.notEquals' },
        { value: '<', label: '<', description: 'operators.lessThan' },
        { value: '<=', label: '≤', description: 'operators.lessThanOrEqual' },
        { value: '>', label: '>', description: 'operators.greaterThan' },
        { value: '>=', label: '≥', description: 'operators.greaterThanOrEqual' }
      );
    }

    if (this.isTimestamp) {
      operators.push(
        { value: '<', label: '<', description: 'operators.before' },
        { value: '>', label: '>', description: 'operators.after' },
        { value: 'BETWEEN', label: '⇔', description: 'operators.between' }
      );
    }

    return operators;
  }

  /**
   * Get default operator for this field type
   * 
   * @returns {string|null} Default operator value
   */
  get defaultOperator() {
    const operators = this.getOperators();
    return operators.length > 0 ? operators[0].value : null;
  }

  /**
   * Get title for UI display (fallback without i18n)
   * Uses schema.title if available, otherwise formats the field ID
   * 
   * @returns {string} Display title
   */
  get title() {
    if (this.schema.title) {
      return this.schema.title;
    }
    
    // Fallback: format field ID
    return this.id
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get localized title for UI display
   * Prefers i18n translation, falls back to schema.title, then formatted ID
   * 
   * @param {Object} i18n - Vue i18n instance ($i18n)
   * @returns {string} Localized display title
   */
  getLocalizedTitle(i18n) {
    // Try i18n translation first
    if (i18n && i18n.te(`fields.${this.id}`)) {
      return i18n.t(`fields.${this.id}`);
    }
    
    // Fallback to schema.title or formatted ID
    return this.title;
  }

  /**
   * Get description for UI display
   * @returns {string} Description text (empty if not defined)
   */
  get description() {
    return this.schema.description || '';
  }

  /**
   * Get enum values if available
   * @returns {Array<string>} Array of allowed values, or empty array
   */
  get enumValues() {
    return Array.isArray(this.schema.enum) ? this.schema.enum : [];
  }

  /**
   * Check if this field has enum values (for dropdown display)
   * @returns {boolean} True if field has predefined values
   */
  get hasEnumValues() {
    return this.enumValues.length > 0;
  }

  /**
   * Check if this field is supported by the frontend
   * A field is supported if it has at least one operator available.
   * @returns {boolean} True if field can be filtered
   */
  get supported() {
    return this.getOperators().length > 0;
  }

  /**
   * Get default value for new filter
   * @returns {*} Default value based on field type
   */
  get defaultValue() {
    if (this.isText) {
      return '';
    }
    if (this.isEnum) {
      return ''; // Single value for = operator, array for IN
    }
    if (this.isTextArray) {
      return [];
    }
    if (this.isNumber) {
      return '';
    }
    if (this.isTimestamp) {
      return null; // Will be single date or { start, end } depending on operator
    }
    return null;
  }

  /**
   * Check if this field requires multi-value input
   * @returns {boolean} True if field expects array or range
   */
  get isMultiValue() {
    return this.isTextArray;
  }

  /**
   * Check if this filter value type changes based on operator
   * Enum fields switch between single value (=, !=) and multi-value (IN)
   * Timestamp fields switch between single date (<, >) and range (BETWEEN)
   * @returns {boolean} True if operator affects input type
   */
  get isOperatorDependent() {
    return this.isTimestamp || this.isEnum || this.isTextArray;
  }

  /**
   * Convert to JSON for debugging
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      supported: this.supported,
      operators: this.getOperators(),
      isMultiValue: this.isMultiValue,
      isOperatorDependent: this.isOperatorDependent,
      schema: this.schema
    };
  }
}