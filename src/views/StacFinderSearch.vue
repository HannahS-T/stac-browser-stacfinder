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
    ...mapState(['stacFinderApiUrl', 'catalogTitle', 'collectionsSearchData']),
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
    },

    /**
     * Unique key for current URL params (used for cache matching)
     */
    currentUrlKey() {
      const q = this.$route.query;
      return JSON.stringify({ q: q.q, bbox: q.bbox, datetime: q.datetime, sort: q.sort });
    }
  },
  created() {
    this.showPage();
    this.initFromUrl();
  },
  watch: {
    // Watch for URL query changes (browser back/forward)
    '$route.query': {
      handler(newQuery, oldQuery) {
        // Only react if query actually changed (not from our own update)
        if (JSON.stringify(newQuery) !== JSON.stringify(oldQuery)) {
          this.initFromUrl();
        }
      },
      deep: true
    }
  },
  methods: {
    /**
     * Initialize state from URL or restore from cache/sessionStorage
     * - URL = Source of Truth for simple filters (q, bbox, datetime, sort)
     * - Vuex Cache = Preserves pagination on back navigation
     * - sessionStorage = Preserves metadataFilters on reload
     */
    initFromUrl() {
      const query = this.$route.query;
      const hasUrlParams = query.q || query.bbox || query.datetime || query.sort || query.limit;
      
      if (!hasUrlParams) {
        return; // No search params - show initial state
      }
      
      // Check if we have a valid Vuex cache for this URL (back navigation)
      const cached = this.collectionsSearchData;
      const cacheHit = cached?.urlKey === this.currentUrlKey;
      
      // Try to restore metadataFilters from sessionStorage (survives reload)
      const sessionData = this.loadFromSession();
      const sessionMatch = sessionData?.urlKey === this.currentUrlKey;
      
      // Restore filters - combine URL params with cached/session metadataFilters
      this.filters = {
        q: query.q || null,
        bbox: query.bbox ? query.bbox.split(',').map(Number) : null,
        datetime: query.datetime ? this.parseDatetimeParam(query.datetime) : null,
        limit: query.limit ? parseInt(query.limit, 10) : null,
        // Priority: Vuex cache > sessionStorage > null
        metadataFilters: cacheHit ? cached.metadataFilters : (sessionMatch ? sessionData.metadataFilters : null),
        cql2: cacheHit ? cached.cql2 : (sessionMatch ? sessionData.cql2 : null)
      };
      
      if (query.sort) {
        this.sortDirection = query.sort.startsWith('-') ? -1 : 1;
        this.sortField = query.sort.replace(/^[+-]/, '');
      }
      
      this.hasSearched = true;
      
      if (cacheHit) {
        // Restore cached results (preserves pagination + metadataFilters)
        this.data = cached.data;
      } else {
        // Cache miss - load fresh
        this.$nextTick(() => this.loadResults());
      }
    },

    /**
     * Parse datetime URL parameter back to array [start, end]
     */
    parseDatetimeParam(datetime) {
      if (!datetime) return null;
      if (datetime.includes('/')) {
        const [start, end] = datetime.split('/');
        return [
          start === '..' ? null : start,
          end === '..' ? null : end
        ];
      }
      return [datetime, datetime];
    },

    /**
     * Update URL with current filter state (enables back/forward navigation)
     */
    updateUrl() {
      const query = {};
      
      if (this.filters.q) {
        query.q = this.filters.q;
      }
      if (Array.isArray(this.filters.bbox) && this.filters.bbox.length === 4) {
        query.bbox = this.filters.bbox.join(',');
      }
      if (Array.isArray(this.filters.datetime)) {
        const [start, end] = this.filters.datetime;
        if (start || end) {
          const s = start || '..';
          const e = end || '..';
          query.datetime = (s === e) ? s : `${s}/${e}`;
        }
      }
      if (this.sortParam && this.sortParam !== '+title') {
        query.sort = this.sortParam;
      }
      if (this.filters.limit && this.filters.limit > 0) {
        query.limit = this.filters.limit;
      }
      
      // Only update if different from current
      if (JSON.stringify(query) !== JSON.stringify(this.$route.query)) {
        this.$router.replace({ query }).catch(() => {});
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
      await this.$nextTick();
      await this.loadResults();
      this.updateUrl();
    },

    async updateSorting() {
      if (this.hasSearched) {
        await this.loadResults();
        this.updateUrl();
      }
    },

    async handlePaginate(link) {
      if (!link?.href) {
        console.error('Invalid pagination link:', link);
        return;
      }
      // Use pagination link directly as provided by API (opaque token)
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
          // Use pagination link directly (as recommended by STAC API)
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
        
        // Cache results in store (for back navigation)
        this.cacheSearchState();

      } catch (error) {
        console.error('Search error:', error);
        this.data = null;
        this.error = getErrorMessage(error);
        this.errorId = getErrorCode(error);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Cache current search state in Vuex store (for back navigation)
     * Also saves metadataFilters to sessionStorage (survives reload)
     */
    cacheSearchState() {
      const cacheData = {
        urlKey: this.currentUrlKey,
        data: this.data,
        metadataFilters: this.filters.metadataFilters || null,
        cql2: this.filters.cql2 || null
      };
      
      // Vuex: for back navigation
      this.$store.commit('setCollectionsSearchData', cacheData);
      
      // sessionStorage: for reload (only metadataFilters, not results)
      this.saveToSession();
    },

    /**
     * Save metadataFilters to sessionStorage (survives page reload)
     */
    saveToSession() {
      if (!this.filters.metadataFilters && !this.filters.cql2) {
        sessionStorage.removeItem('stacfinder-search');
        return;
      }
      try {
        sessionStorage.setItem('stacfinder-search', JSON.stringify({
          urlKey: this.currentUrlKey,
          metadataFilters: this.filters.metadataFilters,
          cql2: this.filters.cql2
        }));
      } catch (e) {
        // sessionStorage might be unavailable or full
        console.warn('Could not save to sessionStorage:', e);
      }
    },

    /**
     * Load metadataFilters from sessionStorage
     */
    loadFromSession() {
      try {
        const data = sessionStorage.getItem('stacfinder-search');
        return data ? JSON.parse(data) : null;
      } catch (e) {
        return null;
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
