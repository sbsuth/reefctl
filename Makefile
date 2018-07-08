start:
	ulimit -c unlimited; \
	echo "Starting reefctl.  Log file `pwd`/reefctl.log"; \
	npm start 2>&1 | cat >  reefctl.log 

stop:
	npm stop

log:
	tail -f reefctl.log

ps:
	-ps -auxw | grep node | grep -v grep

restart_db:
	sudo systemctl restart mongodb.service
