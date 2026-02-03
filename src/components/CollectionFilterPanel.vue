<template>
  <b-form class="filter collection-filter-panel" @submit.stop.prevent="submitFilters" @reset.stop.prevent="resetFilters">
    <b-card no-body>
      <b-card-body>
        <!-- Free-text search -->
        <b-form-group
          class="filter-freetext"
          :label="$t('search.freeText')"
          :description="$t('search.freeTextCollectionDescription')"
        >
          <SearchBox v-model="query.q" :placeholder="$t('search.enterSearchTerms')" />
        </b-form-group>

        <!-- Temporal filter -->
        <b-form-group
          class="filter-datetime"
          :label="$t('search.temporalExtent')"
          :description="$t('search.dateDescription')"
        >
          <div class="datetime-inputs">
            <div class="datetime-field">
              <label>{{ $t('search.startDate') }}</label>
              <DatePicker
                type="datetime"
                v-model="start"
                :get-classes="getRangeClasses"
                input-class="form-control mx-input"
                :lang="datepickerLang"
                :format="dateTimeFormat"
                :default-value="end || new Date()"
                :disabled-date="disabledStartDate"
                :disabled-time="disabledStartTime"
              />
            </div>
            <div class="datetime-field">
              <label>{{ $t('search.endDate') }}</label>
              <DatePicker
                type="datetime"
                v-model="end"
                :get-classes="getRangeClasses"
                input-class="form-control mx-input"
                :lang="datepickerLang"
                :format="dateTimeFormat"
                :default-value="end || new Date()"
                :disabled-date="disabledEndDate"
                :disabled-time="disabledEndTime"
              />
            </div>
          </div>
        </b-form-group>

        <!-- Spatial filter -->
        <b-form-group class="filter-bbox" :label="$t('search.spatialExtent')">
          <MapSelect v-model="bbox" :stac="resolvedStac" />
          <div class="spatial-relation mt-2">
            <label>{{ $t('search.spatialRelationType') }}</label>
            <b-form-select v-model="selected" :options="options" size="sm" />
          </div>
        </b-form-group>

        <!-- Additional metadata filters -->
        <b-form-group
          v-if="queryablesLoaded && queryables.length > 0"
          class="additional-filters"
          :label="$t('search.additionalFilters')"
        >
          <b-form-radio-group
            v-model="logicalOperator"
            :options="logicalOperatorOptions"
            name="logical-operator"
            size="sm"
            class="mb-2"
          />

          <b-dropdown
            size="sm"
            block
            variant="primary"
            :text="$t('search.addFilter')"
            :disabled="availableQueryables.length === 0"
            class="queryables mb-3"
            menu-class="w-100"
          >
            <template v-for="queryable in sortedQueryables">
              <b-dropdown-item
                v-if="queryable.supported"
                :key="queryable.id"
                @click="addMetadataFilter(queryable)"
                link-class="d-flex justify-content-between align-items-center"
              >
                <span>{{ queryable.getLocalizedTitle($i18n) }}</span>
                <b-badge variant="dark" class="ml-2">{{ queryable.id }}</b-badge>
              </b-dropdown-item>
            </template>
          </b-dropdown>

          <CollectionMetadataFilter
            v-for="(filter, index) in metadataFilters"
            :key="`filter-${filter.queryable.id}-${index}`"
            :filter="filter"
            :index="index"
            @update="updateFilter"
            @remove="removeFilter"
          />
        </b-form-group>

        <!-- Loading/Error for queryables -->
        <div v-if="!queryablesLoaded" class="text-center py-2">
          <b-spinner small />
          <span class="ml-2 text-muted">{{ $t('search.loadingFilters') }}</span>
        </div>
        <b-alert v-if="queryablesError" variant="warning" show dismissible @dismissed="queryablesError = null">
          {{ queryablesError }}
        </b-alert>

        <hr>

        <!-- Items per page -->
        <b-form-group
          class="limit"
          :label="$t('search.itemsPerPage')"
          :description="$t('search.itemsPerPageDescription', { maxItems })"
        >
          <b-form-input
            v-model.number="limit"
            type="number"
            min="1"
            :max="maxItems"
            :placeholder="limitPlaceholder"
          />
        </b-form-group>
      </b-card-body>

      <b-card-footer>
        <b-button type="submit" variant="primary">{{ $t('submit') }}</b-button>
        <b-button type="reset" variant="danger" class="ml-3">{{ $t('reset') }}</b-button>
      </b-card-footer>
    </b-card>
  </b-form>
</template>

<script>
import {
  BCard,
  BCardBody,
  BCardFooter,
  BForm,
  BFormGroup,
  BDropdown,
  BDropdownItem,
  BButton,
  BFormSelect,
  BFormRadioGroup,
  BFormInput,
  BBadge,
  BSpinner,
  BAlert
} from 'bootstrap-vue';

import DatePickerMixin from './DatePickerMixin';
import Utils from '../utils';
import { mapGetters } from 'vuex';
import collectionAdapter from '../adapters/CollectionApiAdapter';


// Import CQL2 classes
import CollectionCql from '../models/cql2/collectionCql';
import CollectionQueryable from '../models/cql2/collectionQueryable';

export default {
  name: 'CollectionFilterPanel',

  components: {
    BCard,
    BCardBody,
    BCardFooter,
    BForm,
    BFormGroup,
    BDropdown,
    BDropdownItem,
    BButton,
    BFormSelect,
    BFormRadioGroup,
    BFormInput,
    BBadge,
    BSpinner,
    BAlert,
    DatePicker: () => import('vue2-datepicker'),
    SearchBox: () => import('./SearchBox.vue'),
    MapSelect: () => import('./maps/MapSelect.vue'),
    CollectionMetadataFilter: () => import('./CollectionMetadataFilter.vue')
  },

  mixins: [DatePickerMixin],

  props: {
    /**
     * Optional STAC instance to use for the MapSelect component.
     * If not provided, the parent reference or root STAC will be used.
     */
    stac: {
      type: Object,
      default: null
    },
    parent: {
      type: [String, Object],
      default: null
    },
    /**
     * Initial filter values to pre-populate the form
     */
    initialFilters: {
      type: Object,
      default: null
    },
    /**
     * Base URL of the STACFinder API 
     */
    apiUrl: {
      type: String,
      default: null
    }
  },

  data() {
    return {
      // spatial filter relation type (default: intersects)
      selected: 'intersects',

      // Free-text search term
      query: {
        q: ''
      },

      // Temporal filter as Date objects start and end
      start: null,
      end: null,

      // Spatial filter as bounding box [minX, minY, maxX, maxY]
      bbox: null,

      // Logical operator for combining metadata filters (AND/OR)
      logicalOperator: 'and',

      // Active metadata filters (CQL2)
      // Each filter: { queryable: CollectionQueryable, operator: string, value: string }
      metadataFilters: [],

      // Items per page (limit)
      limit: null,

      // Available queryables from API
      queryables: [],
      queryablesLoaded: false,
      queryablesError: null
    };
  },

  computed: {
    ...mapGetters(['getStac', 'root']),

    /**
     * Check if any filter is currently active
     */
    hasActiveFilters() {
      return Boolean(
        this.query.q ||
        this.start ||
        this.end ||
        (Array.isArray(this.bbox) && this.bbox.length === 4) ||
        this.metadataFilters.length > 0 ||
        this.limit
      );
    },

    /**
     * Spatial relation options for bbox filter
     */
    options() {
      const _ = this.$i18n.locale; // dependency on locale
      return [
        { value: 'intersects', text: this.$t('search.intersects') },
        { value: 'contains',   text: this.$t('search.contains') },
        { value: 'overlaps',   text: this.$t('search.overlaps') },
        { value: 'within',     text: this.$t('search.within') }
      ];
    },

    /**
     * AND/OR options for combining metadata filters
     */
    logicalOperatorOptions() {
      return [
        { value: 'and', text: this.$t('search.logical.and') },
        { value: 'or', text: this.$t('search.logical.or') }
      ];
    },

    /**
     * Maximum items per page (matches backend maxLimit)
     */
    maxItems() {
      return 10000;
    },

    /**
     * Placeholder for limit input showing the default value
     */
    limitPlaceholder() {
      return this.$t('defaultWithValue', { value: 9 });
    },


    /**
     * Queryables available for selection
     */
    availableQueryables() {
      return this.queryables.slice(0);
    },

    /**
     * Queryables sorted alphabetically for the dropdown menu
     */
    sortedQueryables() {
      if (!Array.isArray(this.queryables)) {
        return [];
      }
      const collator = new Intl.Collator(this.$i18n?.locale || 'en');
      return this.queryables.slice(0).sort((a, b) =>
        collator.compare(a.getLocalizedTitle(this.$i18n), b.getLocalizedTitle(this.$i18n))
      );
    },

    /**
     * Resolve the STAC instance for MapSelect.
     * Matches the logic used in the STAC Browser.
     */
    resolvedStac() {
      if (this.stac) return this.stac;
      if (!this.parent) return this.root || null;

      if (typeof this.parent === 'string') {
        return this.getStac
          ? this.getStac(this.parent) || this.root || null
          : this.root || null;
      }

      if (typeof this.parent === 'object') {
        const url = this.parent.url || this.parent.href || this.parent.id || null;
        if (typeof url === 'string') {
          return this.getStac
            ? this.getStac(url) || this.parent || this.root || null
            : this.parent;
        }
        return this.parent;
      }

      return this.root || null;
    }
  },

  watch: {
    /**
     * Watch for changes in initialFilters prop and restore them
     */
    initialFilters: {
      handler() {
        this.restoreFilters();
      },
      deep: true
    }
  },

  async mounted() {
    await this.loadQueryables();
    this.restoreFilters();
  },

  methods: {
    /**
     * Restore filters from initialFilters prop
     */
    restoreFilters() {
      if (!this.initialFilters) return;

      // Restore free-text search
      if (this.initialFilters.q) {
        this.query.q = this.initialFilters.q;
      }

      // Restore datetime (array [start, end])
      if (Array.isArray(this.initialFilters.datetime)) {
        const [start, end] = this.initialFilters.datetime;
        this.start = start ? new Date(start) : null;
        this.end = end ? new Date(end) : null;
      }

      // Restore bbox
      if (Array.isArray(this.initialFilters.bbox)) {
        this.bbox = this.initialFilters.bbox;
      }

      // Restore logical operator for metadata filters
      if (this.initialFilters.logicalOperator === 'and' || this.initialFilters.logicalOperator === 'or') {
        this.logicalOperator = this.initialFilters.logicalOperator;
      }

      // Restore limit (items per page)
      if (typeof this.initialFilters.limit === 'number' && this.initialFilters.limit > 0) {
        this.limit = this.initialFilters.limit;
      }

      // Restore metadata filters (requires queryables to be loaded)
      this.restoreMetadataFilters();
    },

    /**
     * Restore metadata filters from serialized format
     * Must be called after queryables are loaded
     */
    restoreMetadataFilters() {
      if (!this.initialFilters?.metadataFilters || !this.queryablesLoaded) {
        return;
      }

      // Clear existing filters first to avoid duplicates
      this.metadataFilters = [];

      for (const serialized of this.initialFilters.metadataFilters) {
        // Find the queryable by ID
        const queryable = this.queryables.find(q => q.id === serialized.queryableId);
        if (queryable) {
          this.metadataFilters.push({
            queryable,
            operator: serialized.operator,
            value: serialized.value
          });
        }
      }
    },

    /**
     * Reset all filters to their initial empty state
     */
    resetFilters() {
      this.query.q = '';
      this.start = null;
      this.end = null;
      this.bbox = null;
      this.logicalOperator = 'and';
      this.metadataFilters = [];
      this.limit = null;
    },

    /**
     * Load queryables from Collections API via adapter
     */
    async loadQueryables() {
      // Skip if no API URL provided (queryables are optional)
      if (!this.apiUrl) {
        this.queryablesLoaded = true;
        return;
      }
      
      try {
        // Fetch queryables from collection adapter
        this.queryables = await collectionAdapter.fetchQueryables(this.apiUrl);
        this.queryablesLoaded = true;
        
        // Try to restore metadata filters now that queryables are loaded
        this.restoreMetadataFilters();
      } catch (error) {
        console.error('Failed to load queryables:', error);
        this.queryablesError = this.$t('errors.loadQueryables');
        this.queryablesLoaded = true;
      }
    },

    /**
     * Add a new metadata filter
     */
    addMetadataFilter(queryable) {
      const operators = queryable.getOperators();
      if (operators.length === 0) {
        console.warn(`No operators for ${queryable.id}`);
        return;
      }

      this.metadataFilters.push({
        queryable,
        operator: operators[0].value,
        value: queryable.defaultValue
      });
    },

    /**
     * Update filter properties
     */
    updateFilter({ index, operator, value }) {
      if (!this.metadataFilters[index]) return;

      const filter = this.metadataFilters[index];

      if (operator !== undefined) {
        filter.operator = operator;
      }
      if (value !== undefined) {
        filter.value = value;
      }
    },

    /**
     * Remove a filter
     */
    removeFilter(index) {
      if (index >= 0 && index < this.metadataFilters.length) {
        this.metadataFilters.splice(index, 1);
      }
    },

    /**
     * Build CQL2 filter string from active metadata filters
     */
    buildCql2Filter() {
      // Use CQL2 spatial filter only for non-intersects relations
      const useCql2Spatial = Array.isArray(this.bbox) && 
                             this.bbox.length === 4 && 
                             this.selected && 
                             this.selected !== 'intersects';

      if (this.metadataFilters.length === 0 && !useCql2Spatial) {
        return null;
      }

      const cql = new CollectionCql();
      
      // Set the logical operator (AND/OR) for combining metadata filters
      cql.setLogicalOperator(this.logicalOperator);

      // Add spatial filter for contains, within, overlaps (not intersects)
      if (useCql2Spatial) {
        cql.addSpatial(this.selected, this.bbox.join(','));
      }

      for (const filter of this.metadataFilters) {
        const { queryable, operator, value } = filter;

        try {
          // Text fields: comparison operators (=, !=, LIKE)
          if (queryable.isText && (operator === '=' || operator === '!=' || operator === 'LIKE')) {
            // Only add filters with non-empty values
            if (value !== null && value !== undefined && value !== '') {
              const trimmedValue = String(value).trim();
              if (trimmedValue) {
                cql.addComparison(queryable.id, operator, trimmedValue);
              }
            }
          }

          // Number fields: comparison operators (=, !=, <, <=, >, >=)
          else if (queryable.isNumber && ['=', '!=', '<', '<=', '>', '>='].includes(operator)) {
            if (value !== null && value !== undefined && value !== '') {
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                cql.addComparison(queryable.id, operator, numValue);
              }
            }
          }

          // Enum fields: single value operators (=, !=)
          else if (queryable.isEnum && (operator === '=' || operator === '!=')) {
            if (value !== null && value !== undefined && value !== '') {
              const trimmedValue = String(value).trim();
              if (trimmedValue) {
                cql.addComparison(queryable.id, operator, trimmedValue);
              }
            }
          }

          // Enum fields: IN operator (multiple values)
          else if (queryable.isEnum && operator === 'IN') {
            if (Array.isArray(value) && value.length > 0) {
              const cleanedValues = value
                .map(v => String(v).trim())
                .filter(v => v !== '');
              if (cleanedValues.length > 0) {
                cql.addIn(queryable.id, cleanedValues);
              }
            }
          }

          // Array fields: single value operators (=, !=)
          else if (queryable.isTextArray && (operator === '=' || operator === '!=')) {
            if (value !== null && value !== undefined && value !== '') {
              const trimmedValue = String(value).trim();
              if (trimmedValue) {
                cql.addComparison(queryable.id, operator, trimmedValue);
              }
            }
          }

          // Array fields: IN operator
          else if (queryable.isTextArray && operator === 'IN') {
            // Value should be an array for IN operator
            if (Array.isArray(value) && value.length > 0) {
              // Filter out empty values and trim
              const cleanedValues = value
                .map(v => String(v).trim())
                .filter(v => v !== '');

              if (cleanedValues.length > 0) {
                cql.addIn(queryable.id, cleanedValues);
              }
            }
          }

          // Number fields: comparison operators (=, !=, <, <=, >, >=)
          else if (queryable.isNumber && ['=', '!=', '<', '<=', '>', '>='].includes(operator)) {
            if (value !== null && value !== undefined && value !== '') {
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                cql.addComparison(queryable.id, operator, numValue);
              }
            }
          }

          // Timestamp fields: BETWEEN operator
          else if (queryable.isTimestamp && operator === 'BETWEEN') {
            // Value should be object with { start, end } for BETWEEN
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              const { start, end } = value;

              // Both start and end must be present
              if (start && end) {
                cql.addBetween(queryable.id, start, end);
              }
            }
          }

          // Timestamp fields: comparison operators (<, >)
          else if (queryable.isTimestamp && (operator === '<' || operator === '>')) {
            // Value should be a single date string
            if (value !== null && value !== undefined && value !== '') {
              const trimmedValue = String(value).trim();
              if (trimmedValue) {
                cql.addComparison(queryable.id, operator, trimmedValue);
              }
            }
          }
      
        } catch (error) {
          console.error('Error building CQL for filter:', filter, error);
        }
      }

      return cql.hasFilters() ? cql.toText() : null;
    },

    /**
     * datetime filter helper methods
     */
    getRangeClasses(cellDate, currentDates, classnames) {
      const classes = [];
      const start = this.start && new Date(this.start).setHours(0, 0, 0, 0);
      const end = this.end && new Date(this.end).setHours(0, 0, 0, 0);
      if (
        !/disabled|active|not-current-month/.test(classnames) &&
        start &&
        end &&
        cellDate.getTime() >= start &&
        cellDate.getTime() <= end
      ) {
        classes.push("in-range");
      }
      return classes;
    },
    disabledStartDate(date) {
      return (
        this.end &&
        new Date(date).setHours(0, 0, 0, 0) >
        new Date(this.end).setHours(0, 0, 0, 0)
      );
    },
    disabledEndDate(date) {
      return (
        this.start &&
        new Date(date).setHours(0, 0, 0, 0) <
        new Date(this.start).setHours(0, 0, 0, 0)
      );
    },
    disabledStartTime(date) {
      return this.end && date > this.end;
    },
    disabledEndTime(date) {
      return this.start && date < this.start;
    },

    /**
     * Collect all filter values and emit them to the parent component.
     * The parent is responsible for mapping these values to API parameters.
     */
    submitFilters() {
      const cql2Filter = this.buildCql2Filter();

      // Serialize metadata filters for restoration (without the queryable instance)
      const serializedMetadataFilters = this.metadataFilters.map(f => ({
        queryableId: f.queryable.id,
        operator: f.operator,
        value: f.value
      }));

      // Use bbox parameter only for 'intersects' (efficient), other relations use CQL2
      const useBboxParam = Array.isArray(this.bbox) && 
                           this.bbox.length === 4 && 
                           this.selected === 'intersects';

      // Datetime parameter: only if at least one date is set
      let datetimeValue = null;
      if (this.start || this.end) {
        datetimeValue = [this.start, this.end].map(d => d ? Utils.dateToUTC(d) : null);
      }

      const filters = {
        q: Utils.hasText(this.query.q)
          ? this.query.q.trim()
          : null,

        datetime: datetimeValue,

        bbox: useBboxParam ? [...this.bbox] : null,

        // CQL2 metadata filter (for API)
        cql2: cql2Filter,

        // Structured metadata filters (for UI restoration)
        metadataFilters: serializedMetadataFilters.length > 0 
          ? serializedMetadataFilters 
          : null,

        // Logical operator for combining metadata filters
        logicalOperator: this.logicalOperator,

        // Items per page
        limit: this.limit && this.limit > 0 ? Math.min(this.limit, this.maxItems) : null
      };

      this.$emit('submit', filters);
    }
  }
};
</script>

<style lang="scss">
@import '../theme/variables.scss';

// Datepicker related style
$default-color: map-get($theme-colors, "secondary");
$primary-color: map-get($theme-colors, "primary");

@import '~vue2-datepicker/scss/index.scss';

// Use same .filter class as native SearchFilter for consistency
.filter.collection-filter-panel {
  position: relative;

  .mx-datepicker {
    width: 100%;
  }

  // Consistent form-group styling
  .form-group {
    > div {
      margin-left: 1em;
    }

    > label {
      font-weight: 600;
    }
  }

  // Datetime inputs layout
  .datetime-inputs {
    margin-left: 1em;

    .datetime-field {
      margin-bottom: 0.75rem;

      &:last-child {
        margin-bottom: 0;
      }

      > label {
        display: block;
        font-weight: normal;
        font-size: 0.9em;
        margin-bottom: 0.25rem;
        color: #6c757d;
      }
    }
  }

  // Spatial relation select
  .spatial-relation {
    margin-left: 1em;

    > label {
      display: block;
      font-weight: normal;
      font-size: 0.9em;
      margin-bottom: 0.25rem;
      color: #6c757d;
    }
  }

  // Additional filters section
  .additional-filters {
    padding-top: 1em;
    border-top: 1px solid rgba(0, 0, 0, .125);
  }

  // Queryables dropdown (same as native SearchFilter)
  .queryables .dropdown-menu {
    max-height: 90vh;
    overflow: auto;
  }
}
</style>