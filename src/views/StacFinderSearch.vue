<template>
  <main class="stacfinder-search d-flex flex-column">
    <!-- Initial State: Only Filter Panel (centered) -->
    <div v-if="!hasSearched" class="filter-only-view">
      <div class="filter-container">
        <h2 class="mb-4 text-center">{{ $t('search.searchCollections') }}</h2>
        <p class="text-muted text-center mb-4">{{ $t('index.stacFinderDescription') }}</p>
        <CollectionFilterPanel 
          :stac="parent" 
          @submit="searchCollections"
        />
      </div>
    </div>

    <!-- Results State: Filter Panel left, Results right -->
    <b-row v-else>
      <!-- Left: Filter Panel -->
      <b-col cols="12" lg="4" class="left">
        <CollectionFilterPanel 
          :stac="parent" 
          @submit="searchCollections"
        />
      </b-col>

      <!-- Right: Results -->
      <b-col cols="12" lg="8" class="right">
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
      data: null,
      filters: {},
      sortField: 'title',
      sortDirection: 1  // 1 = ASC, -1 = DESC
    };
  },
  computed: {
    ...mapState(['stacFinderApiUrl', 'catalogTitle']),
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
  },
  methods: {
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
      this.filters = filters;
      this.hasSearched = true;
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
      max-width: 600px;
    }
  }

  // Results state
  .left {
    margin-bottom: $block-margin;
  }

  .right {
    position: relative;
    min-height: 300px;
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
