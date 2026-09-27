
API_URL      ?= http://localhost:3000
FRONTEND_URL ?= http://localhost:4200
IMAGES_DIR   := docs/images
TIMESTAMP    := $(shell date +%Y%m%d-%H%M)

.PHONY: demo-traffic demo-anomalies demo-wait demo-screenshot demo-full

## Trafic normal sur l'API (baseline pour le modèle ML)
demo-traffic:
	@echo "==> Trafic normal vers $(API_URL)/tasks"
	@for i in $$(seq 1 100); do \
		curl -s -o /dev/null $(API_URL)/tasks; \
		sleep 0.2; \
	done
	@echo "==> Trafic normal terminé."

## Injection massive d'erreurs (endpoint simulate-failure)
demo-anomalies:
	@echo "==> Injection d'anomalies via $(API_URL)/tasks/simulate-failure"
	@for i in $$(seq 1 200); do \
		curl -s -o /dev/null -X POST $(API_URL)/tasks/simulate-failure; \
		sleep 0.1; \
	done
	@echo "==> Anomalies injectées."

## Attente du cycle de polling ML (Loki -> features -> Isolation Forest -> backend)
demo-wait:
	@echo "==> Attente du cycle de polling ML-service (30s)..."
	@sleep 30

#
	@mkdir -p $(IMAGES_DIR)
	@echo "==> Capture $(FRONTEND_URL)/anomalies"
	npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 \
		$(FRONTEND_URL)/anomalies $(IMAGES_DIR)/anomalies-$(TIMESTAMP).png
	@cp $(IMAGES_DIR)/anomalies-$(TIMESTAMP).png $(IMAGES_DIR)/anomalies-latest.png
	@echo "==> Capture $(FRONTEND_URL)/dashboard"
	npx playwright screenshot --viewport-size=1440,900 --wait-for-timeout=3000 \
		$(FRONTEND_URL)/dashboard $(IMAGES_DIR)/dashboard-$(TIMESTAMP).png
	@cp $(IMAGES_DIR)/dashboard-$(TIMESTAMP).png $(IMAGES_DIR)/dashboard-latest.png
	@echo "==> Screenshots sauvegardés dans $(IMAGES_DIR)/"

## Pipeline complet : trafic -> anomalies -> attente -> screenshot
demo-full: demo-traffic demo-anomalies demo-wait demo-screenshot
	@echo "==> Démo terminée."