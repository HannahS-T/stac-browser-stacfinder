<template>
  <div class="collection-metadata-filter">
    <b-row class="align-items-center filter-row">
      
      <!-- Field Label -->
      <b-col md="3" class="field-info">
        <span class="field-title font-weight-bold">{{ filter.queryable.title }}</span>
        <small 
          v-if="filter.queryable.description" 
          class="field-description text-muted d-block"
        >
          {{ filter.queryable.description }}
        </small>
      </b-col>

      <!-- Operator Dropdown -->
      <b-col md="2" class="operator-col">
        <b-form-select
          :value="filter.operator"
          :options="operatorOptions"
          size="sm"
          @change="onOperatorChange"
          class="operator-select"
        />
      </b-col>

      <!-- Value Input (Text only for now) -->
      <b-col md="6" class="value-col">
        <b-form-input
          :value="filter.value"
          @input="onValueChange"
          size="sm"
          type="text"
          :placeholder="getPlaceholder()"
          class="value-input"
        />
      </b-col>

      <!-- Remove Button -->
      <b-col md="1" class="text-right remove-col">
        <b-button
          size="sm"
          variant="danger"
          @click="$emit('remove', index)"
          :title="$t('remove')"
          class="remove-btn"
        >
          <b-icon-x-circle-fill aria-hidden="true" />
        </b-button>
      </b-col>
      
    </b-row>
  </div>
</template>

<script>
import {
  BRow,
  BCol,
  BFormSelect,
  BFormInput,
  BButton,
  BIconXCircleFill
} from 'bootstrap-vue';

/**
 * CollectionMetadataFilter - Single filter row component
 * 
 * Displays one CQL2 filter with field, operator, and value input.
 * Currently supports text fields only - will be extended for arrays and timestamps.
 * 
 * @emits update - When filter properties change
 * @emits remove - When filter should be removed
 */
export default {
  name: 'CollectionMetadataFilter',
  
  components: {
    BRow,
    BCol,
    BFormSelect,
    BFormInput,
    BButton,
    BIconXCircleFill
  },

  props: {
    /**
     * Filter object
     * @type {Object}
     * @property {CollectionQueryable} queryable - Field definition
     * @property {string} operator - Selected operator
     * @property {string} value - Filter value 
     */
    filter: {
      type: Object,
      required: true,
      validator(filter) {
        return filter.queryable && filter.operator !== undefined;
      }
    },

    /**
     * Filter index in parent array
     * Used for update events
     */
    index: {
      type: Number,
      required: true
    }
  },

  computed: {
    /**
     * Format operators for b-form-select
     * @returns {Array<Object>} Options with value and text
     */
    operatorOptions() {
      return this.filter.queryable.getOperators().map(op => ({
        value: op.value,
        text: `${op.label} ${op.description}`,
        title: op.description
      }));
    }
  },

  methods: {
    /**
     * Handle operator change
     */
    onOperatorChange(operator) {
      this.$emit('update', { 
        index: this.index, 
        operator 
      });
    },

    /**
     * Handle value change
     */
    onValueChange(value) {
      this.$emit('update', { 
        index: this.index, 
        value 
      });
    },

    /**
     * Get contextual placeholder text
     * @returns {string} Placeholder text
     */
    getPlaceholder() {
      const title = this.filter.queryable.title;
      
      if (this.filter.operator === 'LIKE') {
        return this.$t('search.enterPattern', { field: title });
      }
      
      return this.$t('search.enterValue', { field: title });
    }
  }
};
</script>

<style lang="scss" scoped>
.collection-metadata-filter {
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);

  &:last-child {
    border-bottom: none;
  }

  .filter-row {
    gap: 0.5rem;
  }

  .field-info {
    .field-title {
      display: block;
      font-size: 0.95rem;
    }

    .field-description {
      font-size: 0.8rem;
      line-height: 1.2;
      margin-top: 0.25rem;
    }
  }

  .operator-select {
    font-size: 0.875rem;
  }

  .value-input {
    font-size: 0.875rem;
  }

  .remove-col {
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .remove-btn {
    padding: 0.25rem 0.5rem;
  }
}

// Responsive adjustments
@media (max-width: 768px) {
  .collection-metadata-filter {
    .filter-row {
      > .col-md-3,
      > .col-md-2,
      > .col-md-6,
      > .col-md-1 {
        flex: 0 0 100%;
        max-width: 100%;
        margin-bottom: 0.5rem;
      }

      .field-info {
        margin-bottom: 0.25rem;
      }

      .remove-col {
        justify-content: flex-start;
      }
    }
  }
}
</style>