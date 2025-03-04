-include .env
export $(shell test -f .env && cut -d= -f1 .env)

DATA_URL = https://data.alterloop.dev

push:
	@git add .
	@git commit -am "Daily update" || true
	@git push

test-list:
	@curl -L \
		-H Secret:$(DATA_SECRET) \
		"$(DATA_URL)/api/list?filter=1"

test-insert:
	@curl -L \
		-H Secret:$(DATA_SECRET) \
		 $(DATA_URL)/api/insert -d '{"sheet":"Test","name":"Frank"}'
