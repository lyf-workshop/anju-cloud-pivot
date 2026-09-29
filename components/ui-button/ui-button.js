Component({
  properties: {
    label: String,
    variant: { type: String, value: "primary" },
    disabled: Boolean,
    loading: Boolean,
  },
  methods: {
    tap() {
      if (!this.data.disabled && !this.data.loading)
        this.triggerEvent("action");
    },
  },
});
