<template>
  <div class="collection-list">
    <Catalogs 
      :catalogs="catalogs" 
      :collectionsOnly="true"
      :hasMore="hasMore"
      :count="totalCount"
      :apiFilters="filters"
      @loadMore="loadMoreCollections"
    >
    </Catalogs>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import Catalogs from '../components/Catalogs.vue';

export default {
  name: "Collections",
  components: {
    Catalogs
  },
  computed: {
    ...mapState(['data']),
    ...mapGetters(['catalogs']),
    
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
    },    
  },
  
  methods: {
    async loadMoreCollections() {
      // TODO: Implement pagination for external collections
      // This would require extending the CollectionApiAdapter
      console.warn('Pagination not yet implemented for external collections');
    }
  }
};
</script>

<style lang="scss">
@import '~bootstrap/scss/mixins';
@import "../theme/variables.scss";

.collection-list {
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