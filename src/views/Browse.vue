<template>
  <main class="browse d-flex flex-column">
    <b-alert v-if="!allowExternalAccess && isExternal" show>{{ $t('errors.noExternalAccess') }}</b-alert>
    <ErrorAlert v-else-if="error" :url="url" :description="errorDescription" :id="errorId" />
    <Loading v-else-if="loading" stretch />
    <component v-else :is="component" :activeFilters="filters" />
  </main>
</template>

<script>
import Item from './Item.vue';
import Catalog from './Catalog.vue';
import Collections from './Collections.vue';
import { mapGetters, mapState } from "vuex";
import BrowseMixin from './BrowseMixin';

export default {
  name: "Browse",
  components: {
    Catalog,
    Collections,
    Item
  },
  mixins: [
    BrowseMixin
  ],
  computed: {
    ...mapState(['url']),
    ...mapGetters(["isItem"]),
    
    isExternalCollectionsList() {
      return this.url === 'internal://collections';
    },
    
    component() {
      if (this.isItem) {
        return 'Item';
      }
      else if (this.isExternalCollectionsList) {
        return 'Collections';
      }
      else {
        return 'Catalog';
      }
    }
  }
};
</script>