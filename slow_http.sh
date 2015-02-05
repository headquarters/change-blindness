#! /bin/bash
# http://mark.koli.ch/slowdown-throttle-bandwidth-linux-network-interface

DEV=lo

# Throttle bandwidth and add latency
sudo tc qdisc add dev $DEV root handle 1: htb default 12 
sudo tc class add dev $DEV parent 1:1 classid 1:12 htb rate 2mbps
sudo tc qdisc add dev $DEV parent 1:12 netem delay 200ms
