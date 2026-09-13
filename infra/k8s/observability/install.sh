set -euo pipefail

NAMESPACE="observability"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Namespace ${NAMESPACE}"
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

echo "==> Repo Helm grafana"
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null
helm repo update >/dev/null

echo "==> Loki (chart grafana/loki v7.3.0, mode SingleBinary)"
helm upgrade --install loki grafana/loki \
  --namespace "${NAMESPACE}" \
  --version 7.3.0 \
  -f "${SCRIPT_DIR}/loki/values-loki.yaml"

echo "==> Grafana Alloy (collecte des logs du namespace aiops)"
helm upgrade --install alloy grafana/alloy \
  --namespace "${NAMESPACE}" \
  -f "${SCRIPT_DIR}/grafana-alloy/values-alloy.yaml" \
  --set-file alloy.configMap.content="${SCRIPT_DIR}/grafana-alloy/alloy-config.alloy"

echo "==> Grafana (datasource Loki provisionnée automatiquement)"
helm upgrade --install grafana grafana/grafana \
  --namespace "${NAMESPACE}" \
  -f "${SCRIPT_DIR}/grafana/values-grafana.yaml"

echo "==> Terminé. Pour accéder à Grafana en local :"
echo "    kubectl -n ${NAMESPACE} port-forward svc/grafana 3001:80"
echo "    puis http://localhost:3001 (admin / admin, cf. values-grafana.yaml)"
