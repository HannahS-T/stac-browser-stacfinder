<template>
  <main class="stacfinder-search d-flex flex-column">
    <!-- Initial State: Only Filter Panel (centered) -->
    <div v-if="!hasSearched" class="filter-only-view">
      <div class="filter-container">
        <p class="text-muted text-center mb-4">{{ $t('index.stacFinderDescription') }}</p>
        <CollectionFilterPanel 
          :stac="parent"
          :initialFilters="filters"
          :apiUrl="stacFinderApiUrl"
          @submit="searchCollections"
        />
      </div>
    </div>

    <!-- Results State: Collapsible Filter + Results -->
    <b-row v-else class="results-view">
      <!-- Left: Collapsible Filter Panel -->
      <b-col 
        cols="12" 
        :lg="showFilters ? 3 : 'auto'" 
        class="left"
        :class="{ 'filter-collapsed': !showFilters }"
      >
        <!-- Collapsed state: just a button -->
        <b-button
          v-if="!showFilters"
          variant="outline-secondary"
          class="filter-expand-btn"
          @click="showFilters = true"
          :title="$t('items.showFilter')"
        >
          ☰ {{ $t('items.filter') }}
        </b-button>

        <!-- Expanded state: full filter panel with collapse button -->
        <div v-else class="filter-panel-wrapper">
          <div class="filter-header d-flex justify-content-between align-items-center mb-2">
            <span class="font-weight-bold">{{ $t('items.filter') }}</span>
            <b-button 
              variant="link" 
              size="sm" 
              class="p-0 text-muted"
              @click="showFilters = false"
              :title="$t('items.hideFilter')"
            >
              ✕
            </b-button>
          </div>
          <CollectionFilterPanel 
            :stac="parent"
            :initialFilters="filters"
            :apiUrl="stacFinderApiUrl"
            @submit="searchCollections"
          />
        </div>
      </b-col>

      <!-- Right: Results -->
      <b-col 
        cols="12" 
        :lg="showFilters ? 9 : true" 
        class="right"
      >
        <!-- Loading State -->
        <Loading v-if="loading" fill top />

        <!-- Error State -->
        <ErrorAlert v-else-if="error" :description="error" :id="errorId" />

        <!-- No Results -->
        <b-alert v-else-if="results.length === 0" variant="warning" show>
          {{ $t('search.noItemsFound') }}
        </b-alert>

        <!-- Results -->
        <template v-else>
          <!-- Sort Controls -->
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

          <!-- Collection Cards -->
          <Catalogs 
            :catalogs="results" 
            :collectionsOnly="true"
            :pagination="pagination"
            :disableLocalSort="true"
            :count="totalCount"
            @paginate="handlePaginate"
          />
        </template>
      </b-col>
    </b-row>
  </main>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import { BFormSelect } from 'bootstrap-vue';
import Loading from '../components/Loading.vue';
import ErrorAlert from '../components/ErrorAlert.vue';
import CollectionFilterPanel from '../components/CollectionFilterPanel.vue';
import collectionAdapter from '../adapters/CollectionApiAdapter';
import Utils from '../utils';
import { createSTAC } from '../models/stac';
import { STAC } from 'stac-js';
import { getErrorCode, getErrorMessage, processSTAC, stacRequest } from '../store/utils';

export default {
  name: 'StacFinderSearch',
  components: {
    BFormSelect,
    Loading,
    ErrorAlert,
    CollectionFilterPanel,
    Catalogs: () => import('../components/Catalogs.vue'),
    SortButtons: () => import('../components/SortButtons.vue')
  },
  data() {
    return {
      // Local state (not persisted)
      loading: false,
      error: null,
      errorId: null,
      showFilters: true,
      sortables: []
    };
  },
  computed: {
    ...mapState(['stacFinderApiUrl', 'catalogTitle', 'stacFinderState']),
    ...mapGetters(['root', 'toBrowserPath']),

    // Map store state to computed properties
    filters() {
      return this.stacFinderState.filters;
    },
    hasSearched() {
      return this.stacFinderState.hasSearched;
    },
    data() {
      return this.stacFinderState.data;
    },
    // Computed with getter/setter for v-model binding
    sortField: {
      get() { return this.stacFinderState.sortField; },
      set(value) { this.$store.commit('setStacFinderSort', { field: value }); }
    },
    sortDirection: {
      get() { return this.stacFinderState.sortDirection; },
      set(value) { this.$store.commit('setStacFinderSort', { direction: value }); }
    },

    parent() {
      return this.root;
    },

    sortOptions() {
      return this.sortables.map(field => ({
        value: field.id,
        text: this.$te(`fields.${field.id}`)
          ? this.$t(`fields.${field.id}`)
          : field.title
      }));
    },

    sortParam() {
      const prefix = this.sortDirection === -1 ? '-' : '+';
      return `${prefix}${this.sortField}`;
    },

    results() {
      if (!this.data || !Array.isArray(this.data.collections)) {
        return [];
      }
      return this.data.collections
        .map(collection => {
          try {
            if (!Utils.isObject(collection) || collection.type !== 'Collection') {
              return null;
            }
            const selfLink = Utils.getLinkWithRel(collection.links, 'self');
            const url = selfLink?.href;
            if (!url) return null;
            const stac = createSTAC(collection, url, this.toBrowserPath(url));
            return processSTAC(this.$store.state, stac);
          } catch (error) {
            console.error('Error processing collection:', error);
            return null;
          }
        })
        .filter(obj => obj instanceof STAC);
    },

    pagination() {
      return Utils.getPaginationLinks(this.data);
    },

    totalCount() {
      return typeof this.data?.numberMatched === 'number' ? this.data.numberMatched : null;
    }
  },
  async created() {
    this.showPage();
    await this.loadSortables();
    // Store state survives navigation 
  },
  methods: {
    async loadSortables() {
      if (!this.stacFinderApiUrl) return;
      try {
        this.sortables = await collectionAdapter.fetchSortables(this.stacFinderApiUrl);
      } catch (error) {
        console.warn('Failed to load sortables:', error);
      }
    },

    showPage() {
      this.$store.commit('showPage', {
        url: null,
        page: () => ({
          title: this.$t('search.searchCollections'),
          description: this.$t('search.stacFinderDescription')
        })
      });
    },

    async searchCollections(filters) {
      // Update store state
      this.$store.commit('updateStacFinderState', {
        filters: { ...filters },
        hasSearched: true
      });
      await this.loadResults();
    },

    async updateSorting() {
      if (this.hasSearched) {
        // Sort change already committed via v-model setter
        await this.loadResults();
      }
    },

    async handlePaginate(link) {
      if (!link?.href) {
        console.error('Invalid pagination link:', link);
        return;
      }
      await this.loadResults(link);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async loadResults(paginationLink = null) {
      this.error = null;
      this.errorId = null;
      this.loading = true;

      try {
        let requestLink;

        if (paginationLink) {
          // Use pagination link directly (already contains filters & sort from API)
          requestLink = paginationLink;
        } else {
          // Build fresh request from store state
          const baseUrl = `${this.stacFinderApiUrl}/collections`;
          requestLink = collectionAdapter.buildFilteredLink(baseUrl, this.filters, this.sortParam);
        }

        const response = await stacRequest(this.$store, requestLink);

        if (!Utils.isObject(response.data) || !Array.isArray(response.data.collections)) {
          throw new Error(this.$t('errors.invalidStacCollections'));
        }

        // Store results in Vuex (survives navigation)
        this.$store.commit('updateStacFinderState', { data: response.data });

      } catch (error) {
        console.error('Search error:', error);
        this.$store.commit('updateStacFinderState', { data: null });
        this.error = getErrorMessage(error);
        this.errorId = getErrorCode(error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style lang="scss" scoped>
@import '~bootstrap/scss/mixins';
@import '../theme/variables.scss';

.stacfinder-search {
  padding: $block-margin;

  // Initial state: centered filter panel
  .filter-only-view {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    min-height: 60vh;
    padding-top: 2rem;

    .filter-container {
      width: 100%;
      max-width: 800px;

      @include media-breakpoint-up(lg) {
        max-width: 900px;
      }
    }
  }

  // Results state - collapsible filter
  .left {
    margin-bottom: $block-margin;
    transition: all 0.2s ease;

    &.filter-collapsed {
      flex: 0 0 auto;
      max-width: none;
      width: auto;
    }

    .filter-expand-btn {
      white-space: nowrap;
    }

    .filter-panel-wrapper {
      .filter-header {
        padding: 0.5rem;
        background-color: #f8f9fa;
        border-radius: 0.25rem 0.25rem 0 0;
        margin: -1px -1px 0 -1px;
      }
    }
  }

  .right {
    position: relative;
    min-height: 300px;
    transition: all 0.2s ease;
  }

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
}
</style>
