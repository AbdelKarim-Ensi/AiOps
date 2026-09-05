terraform {
  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "0.6.0"
    }
  }
}

provider "kind" {}

resource "kind_cluster" "default" {
  name           = var.cluster_name
  wait_for_ready = var.wait_for_ready
}
