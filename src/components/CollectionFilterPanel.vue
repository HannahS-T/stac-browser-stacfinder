<template>
  <b-card no-body class="collection-filter-panel mb-4">
    <b-card-header>
      <h5 class="mb-0">{{ $t('search.searchCollections') }}</h5>
    </b-card-header>
    <b-card-body>

      <!--Keyword filter-->
      <b-form-group
        :label="$t('search.KeywordSearch')"
      >
        <SearchBox />
      </b-form-group>
      
      <!--Time filter --> 
      <b-form-group 
        class="filter-datetime" 
        :label="$t('search.temporalExtent')" 
        :label-for="`cfp-datetime-${filterId}`" 
        :description="$t('search.dateDescription')"
      >
        <date-picker
          :id="`cfp-datetime-${filterId}`"
          range 
          type="datetime" 
          v-model="datetimeRange" 
          input-class="form-control mx-input"
          :lang="datepickerLang" 
          :format="dateTimeFormat"
          @input="emitFilter"
        />
      </b-form-group>

      <!--Map filter-->
      <b-form-group  :label="$t('search.spatialExtent')">
        <MapSelect
          v-model="query.bbox"
          :stac="{}"
        />
      </b-form-group>

      <!--Metadata filter --> 
      <b-form-group v-if="showAdditionalFilters" class="additional-filters" :label="$t('search.additionalFilters')">
        <b-dropdown size="sm" :text="$t('search.addFilter')" block variant="primary" class="metadata-filters mt-2 mb-3" menu-class="w-100">
          <b-dropdown-item-button
            v-for="metadata in availableMetadataOptions"
            :key="metadata.id"
            @click="additionalFieldSelected(metadata)"
          >
            <span>{{ metadata.title }}</span>
            <b-badge variant="dark" class="ml-2">{{ metadata.id }}</b-badge>
          </b-dropdown-item-button>
        </b-dropdown>

        <div v-for="(filter, index) in metadataFilters" :key="`${filter.id}-${index}`" class="metadata-filter-row mt-3">
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
                <b-icon-x-circle-fill aria-hidden="true" />
              </b-button>
            </b-col>
          </b-row>
        </div>
      </b-form-group>
    </b-card-body>
  </b-card>
</template>

<script>
import { 
  BCard, BCardBody, BCardHeader, BForm, BFormGroup, 
  BDropdown, BDropdownItemButton, BButton, BCol, BRow, 
  BFormInput, BBadge, BIconXCircleFill 
} from 'bootstrap-vue';

import DatePickerMixin from './DatePickerMixin';
import Utils from '../utils';

let filterId = 0;

export default {
  name: 'CollectionFilterPanel',
  components: {
    BCard,
    BCardBody,
    BCardHeader,
    BForm,
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
    MapSelect: () => import('./maps/MapSelect.vue'),
  },
  watch: {
    query: {
      deep: true,
      handler(query) {
        if (query?.bbox) {
          // Store the previously selected bbox so that it can be restored after the
          // map had been hidden accidentally.
          this.bbox = query.bbox;
        }
      }
    ,
    provideBBox(shown) {
      if (!shown) {
        this.query.bbox = null;
      }
      else {
        this.query.bbox = this.bbox;
      }
    }
    }
  },
  props: {
    parent: {
      type: Object,
      default: null
    },
    stac: Object,
    value: Object
  },
  mixins: [DatePickerMixin],
  data() {
    return {
      datetimeRange: null,
      filterId: ++filterId,
      metadataFilters: [],
      allMetadataOptions: [
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'keywords', title: 'Keywords' },
        { id: 'license', title: 'License' },
        { id: 'providers', title: 'Providers' }
      ],

      query: {
        bbox: null
      }
    };
  },
  computed: {
    showAdditionalFilters() {
      return this.allMetadataOptions.length > 0;
    },

    availableMetadataOptions() {
      const selected = this.metadataFilters.map(f => f.id);
      return this.allMetadataOptions.filter(opt => !selected.includes(opt.id));
    },
    
    // Resolve a STAC instance for MapSelect: prefer explicit prop, then resolve via store using parent
    resolvedStac() {
      if (this.stac) return this.stac;
      if (!this.parent) return this.root || null;

      // if parent is a string URL
      if (typeof this.parent === 'string') {
        return this.getStac(this.parent) || this.root || null;
      }

      // if parent looks like a STAC-like object, try to return it or lookup by a url-like property
      if (typeof this.parent === 'object') {
        // common property names that might hold the URL
        const url = this.parent.url || this.parent.href || this.parent.id || null;
        if (typeof url === 'string') {
          return this.getStac(url) || this.parent || this.root || null;
        }
        return this.parent;
      }

      return this.root || null;
    }
  },
  methods: {
    emitFilter() {
      // Convert datetimeRange to UTC format similar to SearchFilter
      let datetime = null;
      if (Array.isArray(this.datetimeRange) && this.datetimeRange.length === 2) {
        datetime = this.datetimeRange.map(d => d ? Utils.dateToUTC(d) : null);
      }
      this.$emit('filter-changed', { datetime });
    },

    additionalFieldSelected(meta) {
      this.metadataFilters.push({
        id: meta.id,
        title: meta.title,
        value: ''
      });
    },
    removeMetadataFilter(index) {
      this.metadataFilters.splice(index, 1);
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
