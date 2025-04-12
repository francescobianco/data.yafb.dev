-include .env
export $(shell test -f .env && cut -d= -f1 .env)


serve:
	npx live-server --host=localhost docs/

update-swagger:
	@mkdir swagger || true
	@cp -r node_modules/swagger-ui-dist/* swagger/
	@cp openapi.json swagger/

push:
	@git add .
	@git commit -am "Daily update" || true
	@git push

test-list:
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/insert" -d '{"sheet":"test_list", "name": "Frank", "age": 10}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test_list"

test-get-by-row:
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=2025&row=2"

test-insert:
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/insert" -d '{"sheet":"2025", "name":"Frank", "age":10, "city":{"name":"Rome","cap":10000}}'

test-delete:
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/insert" -d '{"sheet":"test-delete", "name": "Frank", "age": 10}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/delete" -d '{"sheet":"test-delete", "row": 2}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/insert" -d '{"sheet":"test-delete", "name": "Frank", "age": 10}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/delete" -d '{"sheet":"test-delete", "name": "Frank"}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/insert" -d '{"sheet":"test-delete", "name": "Frank", "age": 10, "city": {"name": "Rome", "cap": 10000}}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/delete" -d '{"sheet":"test-delete", "city": {"cap": 10000}}'
	@curl -L -H Secret:$(DATA_SECRET) "$(DATA_URL)/list?sheet=test-delete"
