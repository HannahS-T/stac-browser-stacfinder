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

      <!-- Additional metadata filters -->
      <!-- Available fields are currently static, later loaded from /queryables -->
      <b-form-group
        v-if="allMetadataOptions.length > 0"
        class="additional-filters"
        :label="$t('search.additionalFilters')"
      >
        <b-dropdown
          size="sm"
          block
          variant="primary"
          :text="$t('search.addFilter')"
          class="metadata-filters mt-2 mb-3"
        >
          <b-dropdown-item-button
            v-for="meta in availableMetadataOptions"
            :key="meta.id"
            @click="addMetadataFilter(meta)"
          >
            {{ meta.title }}
            <b-badge variant="dark" class="ml-2">{{ meta.id }}</b-badge>
          </b-dropdown-item-button>
        </b-dropdown>

        <!-- Render active metadata filters -->
        <div
          v-for="(filter, index) in metadataFilters"
          :key="`${filter.id}-${index}`"
          class="metadata-filter-row mt-3"
        >
          <b-row class="align-items-center">
            <b-col md="4" class="font-weight-bold">
              {{ filter.title }}
            </b-col>

            <b-col md="6">
              <b-form-input
                v-model="filter.value"
                size="sm"
                :placeholder="`Enter ${filter.title}`"
              />
            </b-col>

            <b-col md="2" class="text-right">
              <b-button
                size="sm"
                variant="danger"
                @click="removeMetadataFilter(index)"
              >
                <b-icon-x-circle-fill />
              </b-button>
            </b-col>
          </b-row>
        </div>
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
  BIconXCircleFill
} from 'bootstrap-vue';

import DatePickerMixin from './DatePickerMixin';
import Utils from '../utils';
import { mapGetters } from 'vuex';

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
    DatePicker: () => import('vue2-datepicker'),
    SearchBox: () => import('./SearchBox.vue'),
    MapSelect: () => import('./maps/MapSelect.vue')
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

      // Active metadata filters selected by the user
      metadataFilters: [],

      // Available metadata fields (later fetched from /queryables)
      allMetadataOptions: [
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'license', title: 'License' },
        { id: 'keywords', title: 'Keywords' }
      ]
    };
  },

  computed: {
    ...mapGetters(['getStac', 'root']),

    /**
     * Metadata fields that are not yet active.
     */
    availableMetadataOptions() {
      const used = this.metadataFilters.map(f => f.id);
      return this.allMetadataOptions.filter(m => !used.includes(m.id));
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

  methods: {
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
     * Add a new metadata filter row.
     */
    addMetadataFilter(meta) {
      this.metadataFilters.push({
        id: meta.id,
        title: meta.title,
        value: ''
      });
    },

    /**
     * Remove a metadata filter row.
     */
    removeMetadataFilter(index) {
      this.metadataFilters.splice(index, 1);
    },

    /**
     * Collect all filter values and emit them to the parent component.
     * The parent is responsible for mapping these values to API parameters.
     */
    submitFilters() {
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

        metadata: this.metadataFilters.reduce((acc, f) => {
          if (Utils.hasText(f.value)) {
            acc[f.id] = f.value;
          }
          return acc;
        }, {})
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