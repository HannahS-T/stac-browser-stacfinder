<template>
  <main class="stacfinder-search">
    <!-- Initial State: Centered Filter Panel -->
    <div v-if="!hasSearched" class="filter-only-view">
      <p class="description text-muted text-center">{{ $t('index.stacFinderDescription') }}</p>
      <CollectionFilterPanel
        :stac="parent"
        :initialFilters="filters"
        :apiUrl="stacFinderApiUrl"
        @submit="searchCollections"
      />
    </div>

    <!-- Results State: Filter + Results side by side -->
    <b-row v-else class="results-view">
      <!-- Left: Filter Panel -->
      <b-col cols="12" lg="4" xl="3" class="filter-column" :class="{ collapsed: !showFilters }">
        <b-button
          v-if="!showFilters"
          variant="outline-primary"
          size="sm"
          class="filter-toggle-btn"
          @click="showFilters = true"
        >
          {{ $t('items.showFilter') }}
        </b-button>

        <template v-else>
          <div class="filter-panel-header">
            <b-button
              variant="outline-secondary"
              size="sm"
              @click="showFilters = false"
            >
              {{ $t('items.hideFilter') }}
            </b-button>
          </div>
          <CollectionFilterPanel
            :stac="parent"
            :initialFilters="filters"
            :apiUrl="stacFinderApiUrl"
            @submit="searchCollections"
          />
        </template>
      </b-col>

      <!-- Right: Results -->
      <b-col cols="12" :lg="showFilters ? 8 : 12" :xl="showFilters ? 9 : 12" class="results-column">
        <Loading v-if="loading" fill top />

        <ErrorAlert v-else-if="error" :description="error" :id="errorId" />

        <b-alert v-else-if="results.length === 0" variant="warning" show>
          {{ $t('search.noItemsFound') }}
        </b-alert>

        <template v-else>
          <!-- Sort Controls -->
          <div class="sort-controls mb-3">
            <b-form-group :label="$t('sort.title')" label-cols="auto" label-class="mb-0 font-weight-bold" class="mb-0">
              <div class="d-flex align-items-center">
                <b-form-select
                  v-model="sortField"
                  :options="sortOptions"
                  size="sm"
                  class="sort-select"
                  @change="updateSorting"
                />
                <SortButtons
                  v-model="sortDirection"
                  :enforce="true"
                  class="ml-2"
                  @input="updateSorting"
                />
              </div>
            </b-form-group>
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
import { BFormSelect, BFormGroup } from 'bootstrap-vue';
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
    BFormGroup,
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    max-width: 700px;
    margin: 0 auto;
    padding-top: 1rem;

    .description {
      margin-bottom: 1.5rem;
    }
  }

  // Results state: filter + results
  .results-view {
    .filter-column {
      margin-bottom: $block-margin;

      &.collapsed {
        flex: 0 0 auto;
        max-width: fit-content;
      }

      .filter-panel-header {
        margin-bottom: 0.75rem;
      }

      .filter-toggle-btn {
        white-space: nowrap;
      }
    }

    .results-column {
      position: relative;
      min-height: 200px;
    }
  }

  .sort-controls {
    .sort-select {
      min-width: 150px;
      max-width: 200px;
    }
  }
}
</style>
