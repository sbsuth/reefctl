start:
	npm start 2>&1 >  reefctl.log &

stop:
	npm stop

log:
	tail -f reefctl.log

ps:
	-ps -auxw | grep node | grep -v grep

restart_db:
	sudo systemctl restart mongodb.service
