output "cluster_name" {
  description = "Nom du cluster kind créé"
  value       = kind_cluster.default.name
}

output "kubeconfig_path" {
  description = "Chemin vers le fichier kubeconfig généré"
  value       = kind_cluster.default.kubeconfig_path
}
