<template>
    <div class="collection-metadata-filter">
        <b-row class="align-items-center filter-row no-gutters">

            <!-- Field Label -->
            <b-col md="3" class="field-info pr-2">
                <span class="field-title font-weight-bold">
                    {{ filter.queryable.getLocalizedTitle($i18n) }}
                </span>
                <small v-if="filter.queryable.description && $i18n.locale === 'de'"
                    class="field-description text-muted d-block">
                    {{ filter.queryable.description }}
                </small>
            </b-col>

            <!-- Operator Dropdown -->
            <b-col md="2" class="operator-col px-2">
                <b-form-select :value="filter.operator" :options="operatorOptions" size="sm" @change="onOperatorChange"
                    class="operator-select" />
            </b-col>

            <!-- Value Input -->
            <b-col md="6" class="value-col px-2">

                <!-- Date Range Picker for BETWEEN operator -->
                <div v-if="isTimestampRange" class="date-range-wrapper">
                    <DatePicker v-model="dateRange" type="datetime" range format="YYYY-MM-DD HH:mm:ss"
                        value-type="format" :placeholder="$t('search.selectDateRange')"
                        input-class="form-control form-control-sm" @input="onDateRangeChange" />
                </div>

                <!-- Single Date Picker for <, > operators -->
                <div v-else-if="isTimestampSingle" class="date-single-wrapper">
                    <DatePicker v-model="singleDate" type="datetime" format="YYYY-MM-DD HH:mm:ss" value-type="format"
                        :placeholder="getDatePlaceholder()" input-class="form-control form-control-sm"
                        @input="onSingleDateChange" />
                </div>

                <!-- Single Enum Dropdown for = or != operator on enum fields -->
                <b-form-select 
                    v-else-if="isEnumSingleSelect" 
                    :value="filter.value" 
                    @change="onValueChange" 
                    size="sm"
                    class="enum-select">
                    <b-form-select-option :value="''" disabled>
                        {{ $t('search.selectValue') }}
                    </b-form-select-option>
                    <b-form-select-option 
                        v-for="option in filter.queryable.enumValues" 
                        :key="option" 
                        :value="option">
                        {{ option }}
                    </b-form-select-option>
                </b-form-select>

                <!-- Multi-Select for Enum Fields with IN operator (with predefined options) -->
                <multiselect 
                    v-else-if="isEnumMultiSelect" 
                    :value="filter.value" 
                    @input="onValueChange" 
                    :options="filter.queryable.enumValues"
                    :multiple="true" 
                    :close-on-select="false" 
                    :clear-on-select="false"
                    :preserve-search="true" 
                    :placeholder="$t('search.selectValues')" 
                    select-label="" 
                    deselect-label="×"
                    :allow-empty="true">
                    <template slot="noResult">
                        <span>{{ $t('search.noOptions') }}</span>
                    </template>
                </multiselect>

                <!-- Multi-Select for text_array Fields (IN operator, free tagging) -->
                <multiselect 
                    v-else-if="isMultiSelect" 
                    :value="filter.value" 
                    @input="onValueChange" 
                    :options="[]"
                    :multiple="true" 
                    :taggable="true" 
                    :close-on-select="false" 
                    :clear-on-select="false"
                    :preserve-search="true" 
                    :tag-placeholder="$t('search.addSearchTerm')"
                    :placeholder="$t('search.enterSearchTerms')" 
                    @tag="addTag" 
                    select-label="" 
                    deselect-label="×"
                    :allow-empty="true">
                    <template slot="noResult">
                        <span>{{ $t('search.noOptions') }}</span>
                    </template>
                </multiselect>

                <!-- Number Input for Number Fields (gsd, etc.) -->
                <b-form-input 
                    v-else-if="isNumberField" 
                    :value="filter.value" 
                    @input="onValueChange" 
                    size="sm" 
                    type="number"
                    step="any"
                    :placeholder="getPlaceholder()" 
                    class="value-input" />

                <!-- Text Input for Text Fields -->
                <b-form-input v-else :value="filter.value" @input="onValueChange" size="sm" type="text"
                    :placeholder="getPlaceholder()" class="value-input" />
            </b-col>

            <!-- Remove Button -->
            <b-col md="1" class="remove-col pl-2">
                <b-button size="sm" variant="danger" @click="$emit('remove', index)" :title="$t('remove') || 'Remove'"
                    class="remove-btn">
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
    BFormSelectOption,
    BFormInput,
    BButton,
    BIconXCircleFill
} from 'bootstrap-vue';
import Multiselect from 'vue-multiselect';
import DatePicker from 'vue2-datepicker';

/**
 * CollectionMetadataFilter - Single filter row component
 * 
 * Displays one CQL2 filter with field, operator, and value input.
 * Supports:
 * - Text fields: text input (=, !=, LIKE)
 * - Enum fields: dropdown for single (=, !=) or multi-select for IN
 * - Array fields: multi-select with tagging (=, !=, IN)
 * - Timestamp fields: single date picker (<, >) or date-range picker (BETWEEN)
 * - Number fields: text input  (=, !=, <, ≤, >, ≥) 
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
        BFormSelectOption,
        BFormInput,
        BButton,
        BIconXCircleFill,
        Multiselect,
        DatePicker
    },

    props: {
        /**
         * Filter object
         * @type {Object}
         * @property {CollectionQueryable} queryable - Field definition
         * @property {string} operator - Selected operator
         * @property {string|Array|Object} value - Filter value
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
         */
        index: {
            type: Number,
            required: true
        }
    },

    computed: {
        /**
         * Format operators for b-form-select
         */
        operatorOptions() {
            return this.filter.queryable.getOperators().map(op => {
                // Get translated label
                const translatedLabel = this.$i18n && this.$i18n.te(op.description)
                    ? this.$i18n.t(op.description)
                    : op.label;

                return {
                    value: op.value,
                    text: `${op.label} ${translatedLabel}`,
                    title: translatedLabel
                };
            });
        },

        /**
         * Check if this filter uses single-select dropdown (enum field with = or !=)
         */
        isEnumSingleSelect() {
            return this.filter.queryable.isEnum && 
                   (this.filter.operator === '=' || this.filter.operator === '!=');
        },

        /**
         * Check if this filter uses multi-select with enum options (enum field with IN)
         */
        isEnumMultiSelect() {
            return this.filter.queryable.isEnum && this.filter.operator === 'IN';
        },

        /**
         * Check if this filter uses multi-select input (text_array with free tagging)
         */
        isMultiSelect() {
            return this.filter.queryable.isTextArray && this.filter.operator === 'IN';
        },

        /**
         * Check if this filter is a number field
         */
        isNumberField() {
            return this.filter.queryable.isNumber;
        },

        /**
         * Check if this filter uses date-range input (BETWEEN)
         */
        isTimestampRange() {
            return this.filter.queryable.isTimestamp && this.filter.operator === 'BETWEEN';
        },

        /**
         * Check if this filter uses single date input (<, >)
         */
        isTimestampSingle() {
            return this.filter.queryable.isTimestamp &&
                (this.filter.operator === '<' || this.filter.operator === '>');
        },

        /**
         * Date range for BETWEEN operator (two-way binding helper)
         */
        dateRange: {
            get() {
                if (!this.isTimestampRange || !this.filter.value) {
                    return null;
                }
                // Value is { start: '...', end: '...' }
                const { start, end } = this.filter.value;
                if (!start || !end) {
                    return null;
                }
                // DatePicker expects [start, end] array
                return [start, end];
            },
            set(range) {
                // DatePicker returns [start, end] array
                if (!range || !Array.isArray(range) || range.length !== 2) {
                    this.onValueChange({ start: null, end: null });
                } else {
                    this.onValueChange({ start: range[0], end: range[1] });
                }
            }
        },

        /**
         * Single date for <, > operators (two-way binding helper)
         */
        singleDate: {
            get() {
                if (!this.isTimestampSingle) {
                    return null;
                }
                return this.filter.value;
            },
            set(date) {
                this.onValueChange(date);
            }
        }
    },

    methods: {
        /**
         * Handle operator change
         */
        onOperatorChange(operator) {
            // When switching operators, reset value to correct type
            let newValue = this.filter.value;

            // Switching to IN: convert to array
            if (operator === 'IN' && !Array.isArray(newValue)) {
                newValue = newValue ? [newValue] : [];
            }
            // Switching to BETWEEN: convert to object with start/end
            else if (operator === 'BETWEEN' && (typeof newValue !== 'object' || Array.isArray(newValue))) {
                newValue = { start: null, end: null };
            }
            // Switching to <, >: convert to single value
            else if ((operator === '<' || operator === '>') && typeof newValue === 'object' && !Array.isArray(newValue)) {
                newValue = null;
            }
            // Switching to other operators: convert to string
            else if (operator !== 'IN' && operator !== 'BETWEEN' && operator !== '<' && operator !== '>' &&
                (Array.isArray(newValue) || typeof newValue === 'object')) {
                newValue = '';
            }

            this.$emit('update', {
                index: this.index,
                operator,
                value: newValue
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
         * Handle date range change (BETWEEN)
         */
        onDateRangeChange(range) {
            // DatePicker emits [start, end] or null
            if (!range || !Array.isArray(range) || range.length !== 2) {
                this.onValueChange({ start: null, end: null });
            } else {
                this.onValueChange({ start: range[0], end: range[1] });
            }
        },

        /**
         * Handle single date change (<, >)
         */
        onSingleDateChange(date) {
            this.onValueChange(date);
        },

        /**
         * Add new tag to multiselect
         */
        addTag(newTag) {
            const trimmed = newTag.trim();
            if (!trimmed) return;

            const currentValues = Array.isArray(this.filter.value) ? this.filter.value : [];

            // Avoid duplicates
            if (!currentValues.includes(trimmed)) {
                this.onValueChange([...currentValues, trimmed]);
            }
        },

        /**
         * Get contextual placeholder text for text fields 
         */
        getPlaceholder() {
            const localizedTitle = this.filter.queryable.getLocalizedTitle(this.$i18n);

            if (this.filter.operator === 'LIKE') {
                return this.$t('search.enterPattern', { field: localizedTitle });
            }

            return this.$t('search.enterValue', { field: localizedTitle });
        },

        /**
         * Get contextual placeholder for date picker 
         */
        getDatePlaceholder() {
            if (this.filter.operator === '<') {
                return this.$t('search.selectDateBefore');
            }
            if (this.filter.operator === '>') {
                return this.$t('search.selectDateAfter');
            }
            return this.$t('search.selectDate');
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
        width: 100%;
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

    .date-range-wrapper,
    .date-single-wrapper {
        width: 100%;
    }

    .remove-col {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }

    .remove-btn {
        padding: 0.25rem 0.5rem;
        white-space: nowrap;
    }
}

// Responsive adjustments
@media (max-width: 768px) {
    .collection-metadata-filter {
        .filter-row {

            >.col-md-3,
            >.col-md-2,
            >.col-md-6,
            >.col-md-1 {
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