<template>
  <div class="collection-list">

    <!-- Sorting controls in the results view -->
    <div class="sort-controls mb-3 d-flex align-items-center">
      <label class="mr-2 mb-0 font-weight-bold">{{ $t('sort.title') }}:</label>
      <b-form-select
        v-model="sortField"
        :options="sortOptions"
        size="sm"
        class="sort-field-select mr-2"
        @change="updateSorting"
      />
      <SortButtons 
        v-model="sortDirection" 
        :enforce="true"
        @input="updateSorting"
      />
    </div>

    <Catalogs 
      :catalogs="catalogs" 
      :collectionsOnly="true"
      :hasMore="hasMore"
      :count="totalCount"
      :apiFilters="filters"
      :disableLocalSort="true"
      @loadMore="loadMoreCollections"
    />
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import Catalogs from '../components/Catalogs.vue';
import SortButtons from '../components/SortButtons.vue';
import { BFormSelect } from 'bootstrap-vue';

export default {
  name: "Collections",
  components: {
    Catalogs,
    SortButtons,
    BFormSelect
  },
  data() {
    return {
      sortField: 'title',
      sortDirection: 1, // 1 = ASC, -1 = DESC
    };
  },
  computed: {
    ...mapState(['data']),
    ...mapGetters(['catalogs']),

    // Computed property for sort options with translation fallback
    sortOptions() {
      return [
        { 
          value: 'title', 
          text: this.$te('fields.title') ? this.$t('fields.title') : 'Title' 
        },
        { 
          value: 'description', 
          text: this.$te('fields.description') ? this.$t('fields.description') : 'Description' 
        },
        { 
          value: 'id', 
          text: this.$te('fields.id') ? this.$t('fields.id') : 'ID' 
        },
        { 
          value: 'license', 
          text: this.$te('fields.license') ? this.$t('fields.license') : 'License' 
        }
      ];
    },
    
    catalogs() {
      // Get collections from the synthetic catalog
      if (this.data?._apiCollections) {
        return this.data._apiCollections;
      }
      return [];
    },
    
    totalCount() {
      return this.data?._totalCount || null;
    },
    
    filters() {
      return this.data?._filters || {};
    },
    
    hasMore() {
      // Check if there are more collections to load
      const total = this.totalCount;
      const loaded = this.catalogs.length;
      return total !== null && loaded < total;
    }
  },
  
  watch: {
    // Initialize sorting from filters when data loads
    filters: {
      immediate: true,
      handler(filters) {
        if (filters.sortby) {
          this.parseSortby(filters.sortby);
        }
      }
    }
  },
  
  methods: {
    /**
     * Parse sortby parameter from filters
     * @param {string} sortby - e.g., "+title", "-id"
     */
    parseSortby(sortby) {
      if (!sortby || typeof sortby !== 'string') return;
      
      const direction = sortby.startsWith('-') ? -1 : 1;
      const field = sortby.replace(/^[+-]/, '');
      
      this.sortDirection = direction;
      this.sortField = field;
    },
    
    /**
     * Build sortby parameter in STAC API format
     * @returns {string} sortby parameter (e.g., "+title", "-id")
     */
    buildSortbyParameter() {
      const prefix = this.sortDirection === -1 ? '-' : '+';
      return `${prefix}${this.sortField}`;
    },
    
    /**
     * Reload collections with new sorting
     */
    async updateSorting() {
      try {
        // Build new filters with updated sorting
        const newFilters = {
          ...this.filters,
          sortby: this.buildSortbyParameter()
        };
        
        // Reload collections with new sorting
        await this.$store.dispatch('loadExternalCollections', {
          show: true,
          filters: newFilters
        });
        
      } catch (error) {
        console.error('Error updating sorting:', error);
        this.$root.$emit('error', error, 'Failed to update sorting');
      }
    },
    
    async loadMoreCollections() {
      // TODO: Implement pagination for external collections
      // This would require extending the CollectionApiAdapter
      console.warn('Pagination not yet implemented for external collections');
    }
  }
};
</script>

<style lang="scss" scoped>
@import '~bootstrap/scss/mixins';
@import "../theme/variables.scss";

.collection-list {
  .sort-controls {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 0.25rem;
    
    label {
      white-space: nowrap;
    }
    
    .sort-field-select {
      min-width: 150px;
      max-width: 250px;
      flex-grow: 1;
    }
  }

  .catalogs {
    .card-columns {
      @include media-breakpoint-up(sm) {
        column-count: 2;
      }
      @include media-breakpoint-up(lg) {
        column-count: 3;
      }
      @include media-breakpoint-up(xxl) {
        column-count: 4;
      }
      @include media-breakpoint-up(xxxl) {
        column-count: 6;
      }
    }
  }
}
</style>