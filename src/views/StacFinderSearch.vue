<template>
  <main class="stacfinder-search d-flex flex-column">
    <!-- Initial State: Only Filter Panel (centered) -->
    <div v-if="!hasSearched" class="filter-only-view">
      <div class="filter-container">
        <p class="text-muted text-center mb-4">{{ $t('index.stacFinderDescription') }}</p>
        <CollectionFilterPanel 
          key="initial-filter"
          :stac="parent"
          :initialFilters="filters"
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
            key="results-filter"
            :stac="parent"
            :initialFilters="filters"
            @submit="searchCollections"
          />
        </div>
      </b-col>

      <!-- Right: Results (expands when filter hidden) -->
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
      loading: false,
      error: null,
      errorId: null,
      hasSearched: false,
      showFilters: true,  // Toggle for collapsible filter panel
      data: null,
      filters: {},
      sortField: 'title',
      sortDirection: 1  // 1 = ASC, -1 = DESC
    };
  },
  computed: {
    ...mapState(['stacFinderApiUrl', 'catalogTitle', 'collectionsFilters', 'collectionsSort']),
    ...mapGetters(['root', 'toBrowserPath']),

    parent() {
      return this.root;
    },

    sortOptions() {
      return collectionAdapter.getSortableFields().map(field => ({
        value: field,
        text: this.$te(`fields.${field}`)
          ? this.$t(`fields.${field}`)
          : field.charAt(0).toUpperCase() + field.slice(1)
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
            let selfLink = Utils.getLinkWithRel(collection.links, 'self');
            let url = selfLink?.href 
              ? Utils.toAbsolute(selfLink.href, this.stacFinderApiUrl)
              : `${this.stacFinderApiUrl}/collections/${collection.id}`;
            
            let stac = createSTAC(collection, url, this.toBrowserPath(url));
            stac = processSTAC(this.$store.state, stac);
            return stac;
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
  created() {
    this.showPage();
    this.restoreFromStore();
  },
  methods: {
    /**
     * Restore filters and sort from Vuex store (for persistence across navigation)
     * If filters exist, automatically trigger a search to show previous results
     */
    restoreFromStore() {
      let hasStoredFilters = false;

      // Restore filters from store
      if (this.collectionsFilters && Object.keys(this.collectionsFilters).length > 0) {
        this.filters = { ...this.collectionsFilters };
        hasStoredFilters = true;
      }

      // Restore sort from store
      if (this.collectionsSort) {
        const sortStr = this.collectionsSort;
        this.sortDirection = sortStr.startsWith('-') ? -1 : 1;
        this.sortField = sortStr.replace(/^[+-]/, '');
      }

      // If we have stored filters, automatically search to restore results
      if (hasStoredFilters) {
        this.hasSearched = true;
        this.$nextTick(() => {
          this.loadResults();
        });
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
      this.filters = { ...filters };
      this.hasSearched = true;
      // Use $nextTick to ensure filters are updated before loading results
      await this.$nextTick();
      await this.loadResults();
    },

    async updateSorting() {
      if (this.hasSearched) {
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
          // Use pagination link directly
          requestLink = paginationLink;
        } else {
          // Build link with filters and sort
          const baseUrl = `${this.stacFinderApiUrl}/collections`;
          requestLink = collectionAdapter.buildFilteredLink(baseUrl, this.filters, this.sortParam);
        }

        const response = await stacRequest(this.$store, requestLink);

        if (!Utils.isObject(response.data) || !Array.isArray(response.data.collections)) {
          throw new Error(this.$t('errors.invalidStacCollections'));
        }

        this.data = response.data;

        // Store filters in vuex for persistence
        this.$store.commit('setCollectionsFilters', this.filters);
        this.$store.commit('setCollectionsSort', this.sortParam);
        if (typeof this.data.numberMatched === 'number') {
          this.$store.commit('setCollectionsNumberMatched', this.data.numberMatched);
        }

      } catch (error) {
        console.error('Search error:', error);
        this.data = null;
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
