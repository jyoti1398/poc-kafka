set -x

docker build . -t grindor
# docker rm slingshot_$1
# docker run --net=host -p $2:$2 --name=slingshot_$1 \
#  -e MODE=cron \
#  -e AWS_REGION=us-east-2 \
#  -e MONGO_SLINGSHOT=mongodb://localhost:27017/slingshot \
#  -e MONGO_TERGEO=mongodb://fynd_slingshot_read:read_slin#gshot!2018@10.0.2.25:27017,10.0.130.83:27017,10.0.2.8:27017/slingshot?replicaSet=re_common_set \
#  -e REDIS_SLINGSHOT=redis://localhost:6379/0 \
#  -e REDIS_WORKER_SLINGSHOT=redis://localhost:6379/0 \
#  -e NEWRELIC_APP=slingshot-pre-production \
#  -e SENTRY_DSN=https://1185a1fc127e450189619c2e8140aa5f@sentry.io/1250237 \
#  -e SENTRY_ENVIRONMENT=pre-production \
#  -e PORT=$2 \
#  -e ORBIS_URL=http://api-pre.addsale.com/orbis \
#  -e TERGEO_URL=http://api-pre.addsale.com/tergeo \
#  -e GRIMLOCK_MAIN_DOMAIN=https://localdev.addsale.com:8080 \
#  -e GRIMLOCK_AUTH_USERNAME=slingshot \
#  -e GRIMLOCK_AUTH_PASSWORD=slingshot#fynd \
#  -e PRISM_URL=http://api-pre.addsale.com/prism \
#  -e LAMBDA_PREFIX=pre \
#  -e LAMBDA_ROLE=arn:aws:iam::400482395759:role/gusher-dev-lambda \
#  -e LAMBDA_DLQ=arn:aws:sqs:us-east-2:400482395759:slingshot-failed-execution \
#  -e SQS_PREFIX=pre \
#  -e SLACK_CHANNEL="#slingshot-test" \
#  -e MWS_DEV_ID=217318991357 \
#  -e MWS_ACCESS_KEY_ID=AKIAI2J54 \
#  -e MWS_SECRET_KEY=QKUaNj9bg+KL2jrV8WGxR/gwaHU9bPcs3+Dg7aTt \
#  -e CRON_JOB=full-inventory-trigger \
#  -e KAFKA_BROKER_LIST="localhost:9092" \
#  -e NODE_TLS_REJECT_UNAUTHORIZED="0" \
#  slingshot:latest
