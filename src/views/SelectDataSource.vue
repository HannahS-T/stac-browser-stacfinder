<template>
  <main class="select-data-source">
    <b-form @submit="go">
      <b-form-group
        id="select" :label="$t('index.specifyCatalog')" label-for="url"
        :invalid-feedback="error" :state="valid"
      >
        <b-form-input id="url" type="url" :value="url" @input="setUrl" placeholder="https://..." />
      </b-form-group>
      <b-button type="submit" variant="primary">{{ $t('index.load') }}</b-button>
    </b-form>
    <hr v-if="stacIndex.length > 0">

    <!-- Filter Collections -->
    <CollectionFilterPanel @filter-changed="setCollectionFilter" />

    <b-form-group v-if="stacIndex.length > 0" class="stac-index">
      <template #label>
        <i18n path="index.selectStacIndex">
          <template #stacIndex>
            <a href="https://stacindex.org" target="_blank">STAC Index</a>
          </template>
        </i18n>
      </template>
      <b-list-group>
        <template v-for="catalog in stacIndex">
          <b-list-group-item button v-if="show(catalog)" :key="catalog.id" :active="url === catalog.url" @click="open(catalog.url)">
            <div class="d-flex justify-content-between align-items-baseline mb-1">
              <strong>{{ catalog.title }}</strong>
              <b-badge v-if="catalog.isApi" variant="danger">{{ $t('index.api') }}</b-badge>
              <b-badge v-else variant="success">{{ $t('index.catalog') }}</b-badge>
            </div>
            <Description :description="catalog.summary" compact />
          </b-list-group-item>
        </template>
      </b-list-group>
    </b-form-group>
  </main>
</template>

<script>
import { BForm, BFormGroup, BFormInput, BListGroup, BListGroupItem } from 'bootstrap-vue';
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
    Description,
    CollectionFilterPanel
  },
  data() {
    return {
      url: '',
      stacIndex: [],
      collectionFilter: null
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
      } catch (errot) {
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
      if(Array.isArray(response.data)) {
        this.stacIndex = response.data;
      }
    } catch (error) {
      console.error(error);
    }
  },
  methods: {
    show(catalog) {
      // Always hide private entries
      if (catalog.access === 'private') {
        return false;
      }

      // If user has entered a URL to open directly or there are filters set
      if (!this.url && !this.collectionFilter) {
        return true;
      }

      // Apply text/url filter from the url input (if provided)
      if (this.url) {
        if (Utils.search(this.url, [catalog.title, catalog.url]) === false) {
          return false;
        }
      }

      // Apply temporal filter from CollectionFilterPanel if present
      if (this.collectionFilter && this.collectionFilter.datetime) {
        const filterDatetime = this.collectionFilter.datetime;
        if (Array.isArray(filterDatetime) && (filterDatetime[0] || filterDatetime[1])) {
          // Try to find temporal extent on the catalog entry
          const temporal = catalog.extent && Array.isArray(catalog.extent.temporal) ? catalog.extent.temporal[0] : null;
          if (!temporal || (!temporal[0] && !temporal[1])) {
            // If the catalog has no temporal info, exclude it when a time filter is requested
            return false;
          }
          const colStart = temporal[0] ? new Date(temporal[0]) : null;
          const colEnd = temporal[1] ? new Date(temporal[1]) : colStart;
          const selStart = filterDatetime[0] ? new Date(filterDatetime[0]) : null;
          const selEnd = filterDatetime[1] ? new Date(filterDatetime[1]) : null;

          // Check for overlap
          if (selStart && selEnd) {
            if (colEnd && colEnd < selStart) return false;
            if (colStart && colStart > selEnd) return false;
          }
          else if (selStart) {
            if (colEnd && colEnd < selStart) return false;
          }
          else if (selEnd) {
            if (colStart && colStart > selEnd) return false;
          }
        }
      }

      return true;
    },
    setUrl(url) {
      this.url = url;
    },
    setCollectionFilter(filter) {
      this.collectionFilter = filter;
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
  flex: 1;
  overflow: hidden;

  hr {
    width: 100%;
  }

  .stac-index {
    margin: 0;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;

    > div {
      display: flex;
      flex-direction: column;
      flex: 1;
      overflow: auto;
      border: 1px solid rgba(0,0,0,.125);
      border-radius: $border-radius;

      .list-group {
        width: 100%;

        .list-group-item {
          border: 0;
          border-bottom: 1px solid rgba(0,0,0,.125);
        }

        .active .styled-description a {
          color: white;
        }
      }
    }
  }
}
</style>