// 有限状态机系统
// by lizzz (http://lizzz0523.github.io/)

define(function(require, exports, module) {

var cache = require('tool/cache'),
    event = require('tool/event'),
    queue = require('tool/queue'),
    _ = require('underscore');


var settings = {
        STATES : 'states',
        MAPSET : 'mapset',
        ASYN_QUEUEU : 'transit'
    };
    

function Fsm(context, initial) {
    // 缓存状态
    cache.set(this, settings.STATES, {length : 0});
    // 一个状态到另个状态的映射
    cache.set(this, settings.MAPSET, {});

    // 事件系统，用于触发事件
    this.event = event(context);
    // 队列系统，用于保持状态同步
    this.queue = queue(this);

    this.isSync = true;

    // 在状态机内部，我们使用index标记状态的名字
    this.index = this.cacheState(initial || 'none');
}

Fsm.create = function(options, context) {
    var machine = new Fsm(options.initial, context);

    _each(options.transits, function(transit) {
        machine.add(transit.action, transit.prev, transit.next);
    });

    _each(options.events, function(event) {
        machine.on(event.name, event.callback);
    });

    return machine;
};

Fsm.prototype = {
    cacheState : function(state) {
        var states = cache.get(this, settings.STATES),
            index;

        if (_.isUndefined(states[state])) {
            index = states.length++;

            // 双向引用
            states[state] = index;
            states[index] = state;
        } else {
            index = states[state];
        }

        return index;
    },

    getState : function(index) {
        var states = cache.get(this, settings.STATES);
        return states[_.isUndefined(index) ? this.index : index];
    },

    add : function(action, prev, next) {
        var prev = this.cacheState(prev || 'none'),
            next = this.cacheState(next),

            mapset = cache.get(this, settings.MAPSET),
            map;

        map = mapset[action] || (mapset[action] = []);
        map[prev] = next;
    },

    on : function(event, callback) {
        return this.event.on(event, callback);
    },

    off : function(event, callback) {
        return this.event.off(event, callback);
    },

    fire : function(action, asyn) {
        var mapset = cache.get(this, settings.MAPSET),
            map = mapset[action],

            prev = {
                index : this.index,
                state : this.getState(),
            },
            next = {};

        // 如果没有同步，则忽略这次调用
        if (!this.isSync) return;

        next.index = map[prev.index];
        next.state = this.getState(next.index);

        // 如果该动作没有使状态发生变化
        // 则触发silent事件
        if (_.isUndefined(next.index)) {
            this.event.emit('silent:' + prev.state, action);
            return;
        }

        this.queue.add(settings.ASYN_QUEUEU, function() {
            this.event.emit('leave:' + prev.state, action);

            this.isSync = false;
            if (asyn) return
                
            this.queue.next(settings.ASYN_QUEUEU);
        });

        this.queue.add(settings.ASYN_QUEUEU, function() {
            this.event.emit('enter:' + next.state, action);

            this.index = next.index;
            this.isSync = true;

            this.queue.next(settings.ASYN_QUEUEU);
        });

        this.queue.next(settings.ASYN_QUEUEU);
    },

    sync : function() {
        if (this.isSync) return;
        this.queue.next(settings.ASYN_QUEUEU);
    }
};


module.exports = Fsm.create;

});