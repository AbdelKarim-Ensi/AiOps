variable "cluster_name" {
  description = "Nom du cluster kind à créer"
  type        = string
  default     = "aiops-cluster-tf"
}

variable "wait_for_ready" {
  description = "Attendre que le cluster soit pleinement opérationnel avant de terminer l'apply"
  type        = bool
  default     = true
}
