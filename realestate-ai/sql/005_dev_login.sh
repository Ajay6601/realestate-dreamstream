#!/bin/sh
# DEV ONLY (used by docker-compose): give the API role a login password.
# In real deployments set the password from your secret manager instead.
set -e
psql -v ON_ERROR_STOP=1 -U postgres -d realestate -c "ALTER ROLE app_user LOGIN PASSWORD 'app_user_pw'"
