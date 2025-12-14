<template>
  <main class="collection-list">

    <!-- Temporary info message -->
    <b-alert show variant="info" class="mb-3">
      <strong>Note:</strong>
      Filtering is not implemented yet. All collections are shown.
    </b-alert>

    <!-- Loading -->
    <b-spinner
      v-if="loading"
      class="d-block mx-auto my-4"
      label="Loading collections"
    />

    <!-- Error -->
    <b-alert
      v-else-if="error"
      show
      variant="danger"
    >
      {{ error }}
    </b-alert>

    <!-- Collection list -->
    <b-list-group v-else>
      <b-list-group-item
        v-for="collection in collections"
        :key="collection.id"
      >
        <h5 class="mb-1">
          {{ collection.title || 'No title.' }}
        </h5>

        <p class="mb-2 text-muted">
          {{ collection.description || 'No description available.' }}
        </p>

        <small class="text-muted">
          License: {{ collection.license || 'n/a' }}
        </small>
      </b-list-group-item>
    </b-list-group>

  </main>
</template>

<script>
import {
  BAlert,
  BListGroup,
  BListGroupItem,
  BSpinner
} from 'bootstrap-vue';

import { fetchCollections } from '../services/collectionApi';

export default {
  name: 'CollectionList',

  components: {
    BAlert,
    BListGroup,
    BListGroupItem,
    BSpinner
  },

  data() {
    return {
      loading: true,
      error: null,
      collections: []
    };
  },

  async created() {
    try {
      const data = await fetchCollections();
      this.collections = data.collections || [];
    } catch (err) {
      console.error(err);
      this.error = 'Failed to load collections from API.';
    } finally {
      this.loading = false;
    }
  }
};
</script>

<style scoped>
.collection-list {
  padding: 1rem;
  overflow-y: auto;
}
</style>
