start:
	npm start 2>&1 >  reefctl.log &

stop:
	npm stop

log:
	tail -f reefctl.log

start_db:
	mongod --dbpath ${PWD}/data &
