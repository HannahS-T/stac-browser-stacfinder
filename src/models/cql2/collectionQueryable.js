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
   * @param {string} id - Field identifier (e.g., 'title', 'license')
   * @param {Object} schema - JSON Schema definition from API
   */
  constructor(id, schema) {
    this.id = id;
    this.schema = schema || {};
  }

  /**
   * Detect field type from JSON Schema
   * 
   * Currently supported types:
   * - string → text field
   * 
   * Future types (will be added):
   * - array + items.type=string → text_array
   * - string + format=date-time → timestamp
   * 
   * @returns {string} Field type
   */
  get type() {
    const schemaType = this.schema.type;
    
    // Text field
    if (schemaType === 'string') {
      return 'text';
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
   * Get supported operators for this field type
   * 
   * Returns array of operator objects with:
   * - value: CQL2 operator string
   * - label: Short display label (symbol)
   * - description: User-friendly description
   * 
   * @returns {Array<Object>} Array of operator definitions
   */
  getOperators() {
    const operators = [];

    if (this.isText) {
      operators.push(
        { value: '=', label: '=', description: 'Gleich' },
        { value: '!=', label: '≠', description: 'Nicht gleich' },
        { value: 'LIKE', label: '~', description: 'Enthält' }
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
   * Get title for UI display
   * Uses schema.title if available, otherwise formats the field ID
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
   * Get description for UI display
   * @returns {string} Description text (empty if not defined)
   */
  get description() {
    return this.schema.description || '';
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
    return null;
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
      schema: this.schema
    };
  }
}