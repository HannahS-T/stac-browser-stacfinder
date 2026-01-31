<template>
  <b-card no-body class="collection-filter-panel mb-4">
    <b-card-header>
      <h5 class="mb-0">{{ $t('search.searchCollections') }}</h5>
    </b-card-header>

    <b-card-body>

      <!-- Free-text search -->
      <b-form-group :label="$t('search.enterSearchTerms')">
        <SearchBox v-model="query.q" :placeholder="$t('search.enterSearchTerms')" />
      </b-form-group>

      <!-- Temporal filter: start / end datetime -->
      <b-form-group class="filter-datetime" :label="$t('search.temporalExtent')"
        :description="$t('search.dateDescription')">
        <b-form-group class="mb-6" :label="$t('search.startDate')">
          <DatePicker type="datetime" v-model="start" :get-classes="getRangeClasses" input-class="form-control mx-input"
            :lang="datepickerLang" :format="dateTimeFormat" :default-value="end || new Date()"
            :disabled-date="disabledStartDate" :disabled-time="disabledStartTime" :label="$t('search.startDate')" />
        </b-form-group>

        <b-form-group class="mb-6" :label="$t('search.endDate')">
          <DatePicker type="datetime" v-model="end" :get-classes="getRangeClasses" input-class="form-control mx-input"
            :lang="datepickerLang" :format="dateTimeFormat" :default-value="end || new Date()"
            :disabled-date="disabledEndDate" :disabled-time="disabledEndTime" />

        </b-form-group>
      </b-form-group>

      <!-- Map filter -->
      <b-form-group style="width: 25%" :label="$t('search.spatialExtent')">
        <MapSelect v-model="bbox" :stac="resolvedStac" />
        <b-form-group :label="$t('search.spatialRelationType')">
          <b-form-select v-model="selected" :options="options"/>
        </b-form-group>
      </b-form-group>

      <!--CQL2 METADATA FILTERS -->

      <!-- Loading State -->
      <div v-if="!queryablesLoaded" class="text-center py-3">
        <b-spinner small></b-spinner>
        <span class="ml-2">{{ $t('search.loadingFilters') }}</span>
      </div>

      <!-- Error State -->
      <b-alert v-if="queryablesError" variant="warning" show dismissible @dismissed="queryablesError = null">
        {{ queryablesError }}
      </b-alert>

      <!-- Additional metadata filters -->
      <b-form-group v-if="queryablesLoaded && queryables.length > 0" class="additional-filters"
        :label="$t('search.additionalFilters')">
        <b-dropdown size="sm" block variant="primary" :text="$t('search.addFilter')"
          :disabled="availableQueryables.length === 0" class="metadata-filters mt-2 mb-3">
          <!-- Queryable Items -->
          <b-dropdown-item-button v-for="queryable in availableQueryables" :key="queryable.id"
            @click="addMetadataFilter(queryable)" class="queryable-item">
            <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
            <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
          </b-dropdown-item-button>

          <!-- Empty State -->
          <b-dropdown-text v-if="availableQueryables.length === 0" class="text-muted">
            {{ $t('search.allFiltersActive') }}
          </b-dropdown-text>
        </b-dropdown>

        <!-- Render active metadata filters -->
        <CollectionMetadataFilter v-for="(filter, index) in metadataFilters"
          :key="`filter-${filter.queryable.id}-${index}`" :filter="filter" :index="index" @update="updateFilter"
          @remove="removeFilter" />
      </b-form-group>

      <!-- Action buttons -->
      <div class="d-flex justify-content-between mt-3">
        <b-button 
          variant="outline-secondary" 
          @click="resetFilters"
          :disabled="!hasActiveFilters"
        >
          {{ $t('reset') }}
        </b-button>
        <b-button variant="primary" @click="submitFilters">
          {{ $t('submit') }}
        </b-button>
      </div>

    </b-card-body>
  </b-card>
</template>

<script>
import {
  BCard,
  BCardBody,
  BCardHeader,
  BFormGroup,
  BDropdown,
  BDropdownItemButton,
  BButton,
  BCol,
  BFormSelect,
  BRow,
  BFormInput,
  BBadge,
  BIconXCircleFill,
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
    BCardHeader,
    BFormGroup,
    BDropdown,
    BDropdownItemButton,
    BButton,
    BCol,
    BFormSelect,
    BRow,
    BFormInput,
    BBadge,
    BIconXCircleFill,
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
    }
  },

  data() {
    return {
      // spatial filters
      selected: null,

      // Free-text search term
      query: {
        q: ''
      },

      // Temporal filter as Date objects start and end
      start: null,
      end: null,

      // Spatial filter as bounding box [minX, minY, maxX, maxY]
      bbox: null,

      // Active metadata filters (CQL2)
      // Each filter: { queryable: CollectionQueryable, operator: string, value: string }
      metadataFilters: [],

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
        this.metadataFilters.length > 0
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
     * Queryables that are not yet in active filters
     */
    availableQueryables() {
      const activeIds = this.metadataFilters.map(f => f.queryable.id);
      return this.queryables.filter(q => !activeIds.includes(q.id));
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
      this.metadataFilters = [];
    },

    /**
     * Load queryables from Collections API via adapter
     */
    async loadQueryables() {
      try {
        // Fetch queryables from collection adapter
        this.queryables = await collectionAdapter.fetchQueryables();
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
      let spatialExpr = null;
      if (Array.isArray(this.bbox) && this.bbox.length == 4 && this.selected) {
       spatialExpr = this.selected;
      }

      if (this.metadataFilters.length === 0 && !spatialExpr) {
        return null;
      }

      const cql = new CollectionCql();

      // Add spatial filter if defined
      if (spatialExpr) {
        cql.addSpatial(spatialExpr, this.bbox.join(','));
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

      const filters = {
        q: Utils.hasText(this.query.q)
          ? this.query.q.trim()
          : null,

        datetime: Array.isArray([this.start, this.end])
          ? [this.start, this.end].map(d => d ? Utils.dateToUTC(d) : null)
          : null,

        bbox: Array.isArray(this.bbox) && this.bbox.length === 4 && !this.selected
          ? [...this.bbox]
          : null,

        // CQL2 metadata filter (for API)
        cql2: cql2Filter,

        // Structured metadata filters (for UI restoration)
        metadataFilters: serializedMetadataFilters.length > 0 
          ? serializedMetadataFilters 
          : null
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

.collection-filter-panel {
  .mx-datepicker {
    width: 100%;
  }

  .form-group {
    >div {
      margin-left: 1em;
    }

    >label {
      font-weight: 600;
    }
  }

  .metadata-filters .dropdown-menu {
    max-height: 90vh;
    overflow: auto;
  }

  .additional-filters {
    margin-top: 1.5em;
    padding-top: 1.5em;
    border-top: 1px solid rgba(0, 0, 0, .125);
  }

  .metadata-filter-row {
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(0, 0, 0, .05);

    &:last-child {
      border-bottom: none;
    }

    .text-right {
      text-align: right;
    }
  }
}

// dropdown styling
.metadata-filters {
  ::v-deep .dropdown-menu {
    max-height: 400px;
    overflow-y: auto;
  }

  ::v-deep .queryable-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;

    &:hover {
      background-color: rgba(0, 123, 255, 0.1);
    }

    .queryable-title {
      flex: 1;
      font-weight: 500;
    }

    .queryable-badge {
      font-size: 0.7rem;
      font-family: 'Courier New', monospace;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    &:hover .queryable-badge {
      opacity: 1;
    }
  }

  ::v-deep .dropdown-text {
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-style: italic;
  }
}
</style>