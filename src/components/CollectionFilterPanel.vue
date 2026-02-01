<template>
  <b-card no-body class="collection-filter-panel mb-4">
    <b-card-header>
      <h5 class="mb-0">{{ $t('search.searchCollections') }}</h5>
    </b-card-header>

    <b-card-body>

      <!-- Free-text search -->
      <b-form-group :label="$t('search.enterSearchTerms')" :description="$t('search.freeTextCollectionDescription')">
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
        
        <!-- AND/OR logical operator selection -->
        <b-form-radio-group 
          v-model="logicalOperator" 
          :options="logicalOperatorOptions" 
          name="logical-operator" 
          size="sm"
          class="mb-2"
        />

        <b-dropdown size="sm" block variant="primary" :text="$t('search.addFilter')"
          :disabled="availableQueryables.length === 0" class="metadata-filters mt-2 mb-3">
          
          <!-- Text: Free text fields (title, description, keywords, etc.) -->
          <template v-if="groupedQueryables.text.length > 0">
            <b-dropdown-header>{{ $t('search.filterGroups.text') }}</b-dropdown-header>
            <b-dropdown-item-button v-for="queryable in groupedQueryables.text" :key="'text-' + queryable.id"
              @click="addMetadataFilter(queryable)" class="queryable-item">
              <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
              <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
            </b-dropdown-item-button>
          </template>

          <!-- Selection: Enum/dropdown fields (license, platform, etc.) -->
          <template v-if="groupedQueryables.selection.length > 0">
            <b-dropdown-divider v-if="groupedQueryables.text.length > 0" />
            <b-dropdown-header>{{ $t('search.filterGroups.selection') }}</b-dropdown-header>
            <b-dropdown-item-button v-for="queryable in groupedQueryables.selection" :key="'sel-' + queryable.id"
              @click="addMetadataFilter(queryable)" class="queryable-item">
              <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
              <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
            </b-dropdown-item-button>
          </template>

          <!-- Temporal: Date/time fields -->
          <template v-if="groupedQueryables.temporal.length > 0">
            <b-dropdown-divider v-if="groupedQueryables.text.length > 0 || groupedQueryables.selection.length > 0" />
            <b-dropdown-header>{{ $t('search.filterGroups.temporal') }}</b-dropdown-header>
            <b-dropdown-item-button v-for="queryable in groupedQueryables.temporal" :key="'temp-' + queryable.id"
              @click="addMetadataFilter(queryable)" class="queryable-item">
              <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
              <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
            </b-dropdown-item-button>
          </template>

          <!-- Numeric: Number fields (gsd, etc.) -->
          <template v-if="groupedQueryables.numeric.length > 0">
            <b-dropdown-divider v-if="groupedQueryables.text.length > 0 || groupedQueryables.selection.length > 0 || groupedQueryables.temporal.length > 0" />
            <b-dropdown-header>{{ $t('search.filterGroups.numeric') }}</b-dropdown-header>
            <b-dropdown-item-button v-for="queryable in groupedQueryables.numeric" :key="'num-' + queryable.id"
              @click="addMetadataFilter(queryable)" class="queryable-item">
              <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
              <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
            </b-dropdown-item-button>
          </template>

          <!-- Other: Uncategorized fields -->
          <template v-if="groupedQueryables.other.length > 0">
            <b-dropdown-divider v-if="groupedQueryables.text.length > 0 || groupedQueryables.selection.length > 0 || groupedQueryables.temporal.length > 0 || groupedQueryables.numeric.length > 0" />
            <b-dropdown-header>{{ $t('search.filterGroups.other') }}</b-dropdown-header>
            <b-dropdown-item-button v-for="queryable in groupedQueryables.other" :key="'other-' + queryable.id"
              @click="addMetadataFilter(queryable)" class="queryable-item">
              <span class="queryable-title">{{ queryable.getLocalizedTitle($i18n) }}</span>
              <b-badge variant="secondary" pill class="ml-2 queryable-badge">{{ queryable.id }}</b-badge>
            </b-dropdown-item-button>
          </template>
        </b-dropdown>

        <!-- Render active metadata filters -->
        <CollectionMetadataFilter v-for="(filter, index) in metadataFilters"
          :key="`filter-${filter.queryable.id}-${index}`" :filter="filter" :index="index" @update="updateFilter"
          @remove="removeFilter" />
      </b-form-group>

      <!-- Items per page -->
      <b-form-group 
        class="limit mt-3" 
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
  BDropdownHeader,
  BDropdownDivider,
  BButton,
  BCol,
  BFormSelect,
  BFormRadioGroup,
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
    BDropdownHeader,
    BDropdownDivider,
    BButton,
    BCol,
    BFormSelect,
    BFormRadioGroup,
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
     * Queryables available for selection, grouped by category.
     * All fields can be added multiple times 
     */
    availableQueryables() {
      return this.queryables.slice(0);
    },

    /**
     * Queryables grouped by type for the dropdown menu
     * Dynamic grouping based on field type properties
     */
    groupedQueryables() {
      const groups = {
        text: [],
        selection: [],
        temporal: [],
        numeric: [],
        other: []
      };

      for (const q of this.queryables) {
        // Categorize by field type (dynamic, not hardcoded)
        if (q.isTimestamp) {
          groups.temporal.push(q);
        } else if (q.isNumber) {
          groups.numeric.push(q);
        } else if (q.isEnum) {
          groups.selection.push(q);
        } else if (q.isText || q.isTextArray) {
          groups.text.push(q);
        } else {
          groups.other.push(q);
        }
      }

      // Sort within each group alphabetically
      const collator = new Intl.Collator(this.$i18n?.locale || 'en');
      for (const key in groups) {
        groups[key].sort((a, b) => 
          collator.compare(a.getLocalizedTitle(this.$i18n), b.getLocalizedTitle(this.$i18n))
        );
      }

      return groups;
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

          // Number fields: comparison operators (=, !=, <, >)
          else if (queryable.isNumber && (operator === '=' || operator === '!=' || operator === '<' || operator === '>')) {
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