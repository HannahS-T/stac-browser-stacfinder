<template>
  <b-card no-body class="collection-filter-panel mb-4">
    <b-card-header>
      <h5 class="mb-0">{{ $t('search.searchCollections') }}</h5>
    </b-card-header>

    <b-card-body>

      <!-- Free-text search -->
      <b-form-group :label="$t('search.enterSearchTerms')">
        <SearchBox
          v-model="query.q"
          :placeholder="$t('search.enterSearchTerms')"
        />
      </b-form-group>

      <!-- Temporal filter: start / end datetime -->
      <b-form-group
        class="filter-datetime"
        :label="$t('search.temporalExtent')"
        :description="$t('search.dateDescription')"
      >
        <b-form-group
          class="mb-6"
          :label="$t('search.startDate')">
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
          :label="$t('search.startDate')"
        />
        </b-form-group>

        <b-form-group
          class="mb-6"
          :label="$t('search.endDate')">
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

        </b-form-group>
      </b-form-group>

      <!-- Map filter -->
      <b-form-group :label="$t('search.spatialExtent')">
        <MapSelect v-model="bbox" :stac="resolvedStac" />
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
      <b-form-group
        v-if="queryablesLoaded && queryables.length > 0"
        class="additional-filters"
        :label="$t('search.additionalFilters')"
      >
        <b-dropdown
          size="sm"
          block
          variant="primary"
          :text="$t('search.addFilter')"
          :disabled="availableQueryables.length === 0"
          class="metadata-filters mt-2 mb-3"
        >
          <b-dropdown-item-button
            v-for="queryable in availableQueryables"
            :key="queryable.id"
            @click="addMetadataFilter(queryable)"
          >
            {{ queryable.title }}
            <b-badge variant="dark" class="ml-2">{{ queryable.id }}</b-badge>
          </b-dropdown-item-button>
        </b-dropdown>

        <!-- Render active metadata filters -->
        <CollectionMetadataFilter
          v-for="(filter, index) in metadataFilters"
          :key="`filter-${filter.queryable.id}-${index}`"
          :filter="filter"
          :index="index"
          @update="updateFilter"
          @remove="removeFilter"
        />
      </b-form-group>

      <!-- Submit button -->
      <b-button
        variant="primary"
        class="mt-3"
        @click="submitFilters"
      >
        {{ $t('submit') }}
      </b-button>

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
    }
  },

  data() {
    return {
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

  async mounted() {
    await this.loadQueryables();
  },

  methods: {
    /**
     * Load queryables from Collections API via adapter
     */
    async loadQueryables() {
      try {
        // Fetch queryables from collection adapter
        this.queryables = await collectionAdapter.fetchQueryables();
        this.queryablesLoaded = true;
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
      if (this.metadataFilters.length === 0) {
        return null;
      }

      const cql = new CollectionCql();

      for (const filter of this.metadataFilters) {
        const { queryable, operator, value } = filter;

        try {
          // Text fields: comparison operators
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

      const filters = {
        q: Utils.hasText(this.query.q)
          ? this.query.q.trim()
          : null,

        datetime: Array.isArray([this.start, this.end])
          ? [this.start, this.end].map(d => d ? Utils.dateToUTC(d) : null)
          : null,

        bbox: Array.isArray(this.bbox) && this.bbox.length === 4
          ? [...this.bbox]
          : null,

        // CQL2 metadata filter
        cql2: cql2Filter
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
    > div {
      margin-left: 1em;
    }

    > label {
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
    border-top: 1px solid rgba(0,0,0,.125);
  }

  .metadata-filter-row {
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(0,0,0,.05);

    &:last-child {
      border-bottom: none;
    }

    .text-right {
      text-align: right;
    }
  }
}
</style>