<template>
  <main class="select-data-source">
    <!-- URL Input Section -->
    <b-card no-body class="mb-4">
      <b-card-header>
        <h5 class="mb-0">{{ $t('index.specifyCatalog') }}</h5>
      </b-card-header>
      <b-card-body>
        <b-form @submit="go">
          <b-form-group id="select" label-for="url" :invalid-feedback="error" :state="valid">
            <b-form-input id="url" type="url" :value="url" @input="setUrl" placeholder="https://..." />
          </b-form-group>
          <b-button type="submit" variant="primary">{{ $t('index.load') }}</b-button>
        </b-form>
      </b-card-body>
    </b-card>

    <!-- Filter Collections Section -->
    <CollectionFilterPanel @submit="browseCollections" />

    <!-- STAC Index Section -->
    <b-card v-if="stacIndex.length > 0" no-body class="stac-index">
      <b-card-header>
        <h5 class="mb-0">
          <i18n path="index.selectStacIndex">
            <template #stacIndex>
              <a href="https://stacindex.org" target="_blank">STAC Index</a>
            </template>
          </i18n>
        </h5>
      </b-card-header>
      <b-card-body class="p-0">
        <b-list-group flush>
          <template v-for="catalog in stacIndex">
            <b-list-group-item button v-if="show(catalog)" :key="catalog.id" :active="url === catalog.url"
              @click="open(catalog.url)">
              <div class="d-flex justify-content-between align-items-baseline mb-1">
                <strong>{{ catalog.title }}</strong>
                <b-badge v-if="catalog.isApi" variant="danger">{{ $t('index.api') }}</b-badge>
                <b-badge v-else variant="success">{{ $t('index.catalog') }}</b-badge>
              </div>
              <Description :description="catalog.summary" compact />
            </b-list-group-item>
          </template>
        </b-list-group>
      </b-card-body>
    </b-card>
  </main>
</template>

<script>
import { BForm, BFormGroup, BFormInput, BListGroup, BListGroupItem, BCard, BCardHeader, BCardBody } from 'bootstrap-vue';
import { mapGetters } from "vuex";
import Description from '../components/Description.vue';
import Utils from '../utils';
import axios from "axios";
import CollectionFilterPanel from '../components/CollectionFilterPanel.vue';

export default {
  name: "SelectDataSource",
  components: {
    BForm,
    BFormGroup,
    BFormInput,
    BListGroup,
    BListGroupItem,
    BCard,
    BCardHeader,
    BCardBody,
    Description,
    CollectionFilterPanel
  },
  data() {
    return {
      url: '',
      stacIndex: []
    };
  },
  computed: {
    ...mapGetters(['toBrowserPath']),
    valid() {
      return !this.error;
    },
    error() {
      if (!this.url) {
        return null;
      }
      try {
        let url = new URL(this.url);
        if (!url.protocol) {
          return this.$t('index.urlMissingProtocol');
        }
        else if (!url.host) {
          return this.$t('index.urlMissingHost');
        }
        return null;
      } catch (error) {
        return this.$t('index.urlInvalid');
      }
    }
  },
  async created() {
    // Reset loaded STAC catalog
    this.$store.commit('resetCatalog', true);
    // Load entries from STAC Index
    try {
      let response = await axios.get('https://stacindex.org/api/catalogs');
      if (Array.isArray(response.data)) {
        this.stacIndex = response.data;
      }
    } catch (error) {
      console.error(error);
    }
  },
  methods: {
    /**
     * When collection filter panel submits filters, load filtered collections
     * @param {Object} filters - Filter object from CollectionFilterPanel
     */
    async browseCollections(filters) {
      try {
        // Build filter object for API
        const apiFilters = {};

        // Add free-text search
        if (filters.q) {
          apiFilters.q = filters.q;
        }

        // Add datetime filter
        if (filters.datetime) {
          apiFilters.datetime = filters.datetime;
        }

        // Add bbox filter (if supported by backend)
        if (filters.bbox) {
          apiFilters.bbox = filters.bbox;
        }

        // Add CQL2 filter 
        if (filters.cql2) {
          apiFilters.cql2 = filters.cql2;
        }

        // Log filters for debugging
        console.log('Submitting collection filters:', apiFilters);

        // Load collections with filters via Vuex action
        await this.$store.dispatch('loadExternalCollections', {
          show: true,
          filters: apiFilters,
          resetPagination: true  // Start from first page
        });

        // Navigate to collections view
        this.$router.push({ name: 'collections' });

      } catch (error) {
        console.error('Error loading filtered collections:', error);
        this.$root.$emit('error', error, 'Failed to load collections');
      }
    },

    show(catalog) {
      if (catalog.access === 'private') {
        return false;
      }
      else if (!this.url) {
        return true;
      }

      return Utils.search(this.url, [catalog.title, catalog.url]);
    },
    setUrl(url) {
      this.url = url;
    },
    open(url) {
      this.url = url;
      this.go();
    },
    go() {
      this.$router.push(this.toBrowserPath(this.url));
    }
  }
};
</script>

<style lang="scss">
@import '../theme/variables.scss';

#stac-browser .select-data-source {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;

  >.card:first-child,
  >div:not(.stac-index),
  >.collection-filter-panel {
    flex-shrink: 0;
    margin: $block-margin;
    margin-bottom: 0;
  }

  .stac-index {
    flex: 0 0 auto;
    margin: $block-margin;
    height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .card-header {
      flex-shrink: 0;
    }

    .card-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 0;
    }

    .list-group {
      width: 100%;
      border-radius: 0;

      .list-group-item {
        border: 0;
        border-bottom: 1px solid rgba(0, 0, 0, .125);

        &:last-child {
          border-bottom: 0;
        }
      }

      .active .styled-description a {
        color: white;
      }
    }
  }
}
</style>